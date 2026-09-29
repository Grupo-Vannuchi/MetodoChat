# O gerador de bônus — Etapa 1: do pedido ao bônus oculto no Método Labs

**Nascido em:** 29/09/2026. O Eduardo acrescenta a este projeto a feature que o Método Labs
decidiu, em 28/09, não construir mais em casa: *"o gerador de prompt e de carrossel [...] passa
a ser desenvolvido pelo Eduardo dentro do Método Chat"* (site-ia, `docs/relatorios/2026-09-28.md`).
**Estado:** Etapa 1 em produção desde 29/09 (PR #1, `main` em `9710339`), construída e provada
pelas FASES 1.1 a 1.12 do plano (docs/plans/2026-09-29-gerador-de-bonus.md). A FASE 1.13 ajusta a
leitura das respostas ao contrato novo do Labs. A porta do Labs segue desligada até a produção
dele ter o conserto (ver "Ligar a porta").
**Projeto de quem:** do Vinícius Gualberto. Esta feature entra como visita: pasta própria e o
mínimo de toque no que já existe.

---

## O que é

Um operador do painel descreve um bônus (tema, o que ele resolve, a palavra-chave opcional). A
IA escreve o bônus, o operador revisa e envia ao Método Labs, que o grava **oculto** pela porta
assinada `POST /api/bonus`. O link público só funciona depois que alguém publica o bônus no
`/admin` do Labs.

O contrato da porta está em `site-ia/docs/contrato-metodo-chat.md`, e esta spec não o repete:
cita só o que muda o desenho.

---

## O que foi medido antes de desenhar

| pergunta | resposta | fonte |
|---|---|---|
| a fila existente serve para a chamada de IA? | **não.** O dreno atende as DMs, roda no `after()` do webhook e do tique, ambos com `maxDuration = 60`, e trata os tipos num laço único. Uma geração de 30–60 s ali prenderia as respostas automáticas e exigiria editar `drainQueue` | `lib/queue-drain.ts`, `app/api/webhook/route.ts:17`, `app/api/queue/tick/route.ts:6` |
| qual o teto de execução? | com Fluid Compute: Hobby 300 s (padrão e máximo), Pro 800 s. **Se o Fluid está ligado neste projeto, e qual é o plano, NÃO foi medido**: nenhuma ferramenta devolve isso | vercel.com/docs/functions/limitations (atualizada em 24/08/2026) |
| `after()` numa Server Action respeita qual teto? | o `maxDuration` da página que a chama | `node_modules/next/dist/docs/.../maxDuration.md` e `after.md` |
| como o Labs reconhece reenvio? | **só pelo slug**, sem comparar mais nada | `site-ia/src/app/api/bonus/route.ts:184-190` |
| como descobrir os temas válidos? | o `GET /api/bonus` do Labs, público, lista os bônus **ativos** com `tema`; a recusa `tema_fora_do_catalogo` traz o catálogo inteiro | `route.ts:20-32` e `:152-167` |
| a migração roda em deploy de preview? | **não**: `migrar.mjs` pula fora de produção | `scripts/migrar.mjs`, "A TRAVA DE PRODUÇÃO" |
| com qual banco o preview conversa? | **o de produção**: a `DATABASE_URL` da Vercel vale para production, preview e development | Vercel, lista de variáveis, 29/09 |
| que variáveis existem na Vercel? | seis: `SUPABASE_BUCKET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `APP_URL`, `DATABASE_URL`, `ADMIN_PASSWORD`. **Não existem** `ANTHROPIC_API_KEY`, `BONUS_INTAKE_SECRET`, `QSTASH_TOKEN`, `CRON_SECRET` | idem, `hiddenProductionEnvCount = 0` |
| o `--aplicar --a-mao` aplica só a migração nova? | **não**: aplica toda pendente, inclusive a `012`, que é de dado e saiu do build | `scripts/migrar.mjs:489` (`SO_A_MAO`) |
| o limitador do Labs grava antes de conferir a assinatura? | **sim**: `checkRateLimit` na linha 82, assinatura na 112. Até uma chamada recusada escreve na produção do Labs, e por isso ninguém sonda a porta | `route.ts:82` e `:112` |

---

## As decisões, e de quem

| decisão | escolha | por quê |
|---|---|---|
| escopo da Etapa 1 | **só o bônus**, até o Labs | é a menor peça que exercita as três coisas novas: chamada longa sob o teto da Vercel, estado gravado, escrita assinada e idempotente. O texto do carrossel já foi provado no Labs em 15/09 e não traz risco novo |
| palavra-chave | a digitada vence; vazia, a IA sugere e o operador confirma | é a armadilha que o Labs já documentou: post pede "IAKIDS", IA inventa "EDUCAIA", e quem comenta não recebe nada |
| teto de gerações | **5 por dia**, somando o painel inteiro | a mesma régua do Labs; a geração é a primeira ação deste painel que gasta dinheiro por clique |
| como se chega na tela | item **"Bônus"** no menu, abaixo de "Publicações" | uma linha num arquivo do dono, trivial de revisar |
| como provar antes do merge | tabela aplicada à mão na produção do Chat, e o Labs rodando **local** | a porta de produção do Labs continua fechada até o Chat estar no ar |
| mecanismo | tabela própria + `after()` da Server Action | ver a medição da fila, acima |
| modelo | `claude-opus-5-5` | padrão da skill `claude-api`; mais novo e mais barato que o `claude-opus-5` do Labs (US$ 4/20 contra 5/25 por MTok). A instrução foi calibrada no `opus-5`, então a primeira geração real é conferida contra a régua de lá |
| schema da saída | `zod` + `zodOutputFormat`, como no Labs | o schema do Labs entra como está, sem uma segunda forma para manter igual |
| `lib/esquema.ts` | **uma entrada em `naoObservaveis`**, e a tabela **fora** de `tabelas` | registrar a tabela faria o painel inteiro, DMs incluídas, se recusar a subir sem ela. Mas `testes-integracao/esquema-de-partida.integracao.ts:62-83` exige que toda migração da pasta esteja declarada na `MARCA_DAGUA`, e roda no container. `naoObservaveis` cumpre a exigência sem que a partida passe a depender da tabela: `faltando()` só percorre `tabelas` e `colunas` (`lib/esquema.ts:220-227`) |
| `scripts/migrar.mjs` | **não é tocado** | a lista `ESPERADAS` só confere depois de aplicar; a `013` é aplicada sem ela, e o teste de integração da feature confere as colunas da tabela |

Todas as decisões são do Eduardo, tomadas em 29/09, exceto o modelo, que segue o padrão da
skill e foi declarado a ele. A do `lib/esquema.ts` foi revista no mesmo dia, depois do achado do
auditor sobre o teste de partida.

---

## As etapas

| etapa | o quê |
|---|---|
| **1** | **esta spec**: gerar o bônus, revisar, enviar ao Labs oculto |
| 2 | o texto do carrossel (gancho, slides, chamada, legenda), com a palavra da chamada virando a do bônus |
| 3 | a arte dos slides em PNG 1080×1350, trazida do Labs |
| 4 | publicar o carrossel pelo `/publicar` que já existe |
| 5 | fechar o funil: saber que o bônus foi publicado no Labs e ligar a automação à palavra |
| depois | ilustração por IA, pautas, edição, modelos salvos |
| **no Labs** | a duplicata só com slug e título iguais, e a violação de unicidade distinguida pelo índice (ver "O conserto no Labs"). Outro repositório, e antes de ligar a porta em produção |

Ideia nova que aparecer durante a Etapa 1 vira fase de uma etapa futura, escrita aqui.

---

## O desenho da Etapa 1

### Onde mora

- `app/bonus/`: as duas telas, as actions e o componente que acompanha a geração.
- `lib/bonus/`: as funções puras (assinatura, leitura da resposta, congelamento, validação,
  relógios) e os dois módulos que falam para fora (IA e Labs), estes com `server-only`.

Fora dessa pasta, e nada mais:

| arquivo | o toque |
|---|---|
| `app/app-shell.tsx` | uma linha no grupo "Gerenciar" e o import de `IconMensagemLink`, que já existe |
| `lib/esquema.ts` | uma entrada em `MARCA_DAGUA.naoObservaveis`, com o motivo |
| `testes-integracao/esquema-de-partida.integracao.ts` | o caso "schema VAZIO" passa a apagar todas as tabelas do schema temporário, e não só as oito da marca d'água, com a trava `exigirPrefixo` antes de apagar. Sem isso, a `013` deixava `bonus_gerados` de pé e o caso falhava (FASE 1.1-bis, decidida pelo Eduardo em 29/09) |
| `migrations/013-bonus-gerados.sql` | arquivo novo |
| `package.json`, `package-lock.json` | `@anthropic-ai/sdk` e `zod` |
| `tests/`, `testes-integracao/`, `testes-dom/` | arquivos novos, prefixados `bonus-` |
| `docs/specs/`, `docs/plans/` | esta spec e o plano |
| `.env.local` | três variáveis; o arquivo continua ignorado pelo git |

### A tabela `bonus_gerados`

Uma linha é um bônus, do pedido ao envio.

| grupo | coluna | nota |
|---|---|---|
| — | `id` | `uuid`, `gen_random_uuid()` |
| pedido | `tema`, `o_que_resolve`, `palavra_digitada` | a palavra pode ser nula |
| geração | `estado` | `pendente` → `gerando` → `pronto` ou `falhou`, com `check` |
| | `gerado` | `jsonb`: o que a IA devolveu, já validado |
| | `revisado` | `jsonb`: o que o operador mandou ao Labs. Separado de `gerado` para se poder comparar máquina e revisão depois |
| | `erro`, `medicao` | o motivo legível; tokens de entrada, saída, cache criado e cache lido |
| | `criado_em`, `gerado_em` | `timestamptz` |
| envio | `slug`, `corpo_enviado` | o slug e a **string exata** enviada. O cabeçalho de assinatura nunca é gravado |
| | `envio_estado` | `enviando`, `criado`, `colisao`, `recusado`, `esperar`, `incerto`, `conferir`, `porta_desligada`, com `check` |
| | `incerto_pendente` | `boolean`: houve tentativa de desfecho incerto ainda não resolvida (ver "O congelamento") |
| | `conferido_pelo_operador` | `boolean`: o `criado` veio da conferência humana, e não de uma resposta do Labs |
| | `envio_resposta` | `jsonb`: status e só os campos conhecidos do contrato, com teto de tamanho |
| | `tentativas`, `envio_iniciado_em`, `enviado_em` | |

### A geração

1. `pedirBonus` (action): confere a sessão, valida o pedido no servidor (tema até 80
   caracteres, o que resolve de 20 a 1 000, palavra opcional), confere o teto (linhas das últimas
   24 h no relógio do banco, **qualquer que seja o estado**: uma geração que falhou também pode
   ter custado), confere `ANTHROPIC_API_KEY`, insere a linha em `pendente` e agenda `after()`.
   **Contar e inserir acontecem numa transação com `pg_advisory_xact_lock`**: sem a trava, dois
   cliques simultâneos com 4 linhas no dia passariam os dois pela contagem e fariam 6.
2. No `after()`: `update ... set estado = 'gerando' where id = $1 and estado = 'pendente'`. **Só
   quem muda a linha chama a IA**; um segundo disparo não gasta outra chamada.
3. A chamada: `claude-opus-5-5`, `client.beta.messages.parse` com `betaZodOutputFormat`, a
   instrução no `system`, o pedido na mensagem do usuário, `effort: "high"` explícito (o nível em
   que a instrução foi calibrada no Labs; o padrão do `opus-5-5` seria `medium`),
   `max_tokens: 16000`, `maxRetries: 0` e timeout do cliente abaixo do teto. Fallback de recusa do
   servidor ligado: `betas: ["server-side-fallback-2026-07-01"]` e `fallbacks: "default"`.
   Conferido nos tipos da SDK (0.120.0, a do Labs): `beta.messages.parse` existe,
   `BetaFallbacksParam` aceita `'default'`, e `betaZodOutputFormat` mora em
   `@anthropic-ai/sdk/helpers/beta/zod`.
   **Sem `cache_control`**, por conta: a escrita no cache custa 1,25× e só se paga com duas
   gerações em 5 minutos, o que o teto de 5 por dia torna raro. A `medicao` grava cache criado e
   lido, então a decisão pode ser revista com número.
4. A linha termina em `pronto` (com `gerado` e `medicao`) ou em `falhou` (com `erro` legível).

**A instrução** é a `INSTRUCAO_BONUS` do Labs, mais a `REGRA_DE_PORTUGUES` que ela importa,
trazidas **como estão** do site-ia, com o commit de origem anotado no arquivo. O schema é o
`BonusGeradoSchema` do Labs. Em 29/09, por decisão do Eduardo, o Labs tirou o gerador da tela de
bônus (site-ia `4662222`, só `novo-bonus-form.tsx`). A cópia de lá **continua** no repositório
dele: `src/lib/ia/instrucao-bonus.ts` segue importada por `gerar.ts` e chamada pelo ramo padrão de
`admin/geracao/actions.ts:185` (medido pelo auditor e conferido em 29/09). Esta cópia é a que gera
os bônus do Chat; as duas podem divergir, e isso é assunto do Labs.

**Os relógios**, numa constante cada, com a ordem verificada por teste (molde:
`site-ia/src/lib/ia/tempos.ts`):

| constante | valor | regra |
|---|---|---|
| `TIMEOUT_IA_MS` | 150 000 | cabe no teto com folga para o `after()` começar e gravar |
| `TRAVADA_MS` | 200 000 | maior que `TIMEOUT_IA_MS`: quem passou disso morreu |
| `DESISTIR_MS` | 240 000 | maior que `TRAVADA_MS`, senão a tela nunca mostra "travou" |
| `maxDuration` das duas páginas | 300 s | maior que `TIMEOUT_IA_MS`. **Exige Fluid Compute** (ver pré-condições) |

**A linha travada** é julgada na leitura: `pendente` ou `gerando` há mais de `TRAVADA_MS` aparece
como "travou", sem cron.

### O envio ao Labs

`enviarAoLabs` (action), síncrono, timeout de 15 s:

1. Confere a sessão e a configuração (`BONUS_INTAKE_SECRET` e `LABS_URL`; sem elas, recusa).
2. Reivindica o envio: `envio_estado = 'enviando'` só se não houver outro envio iniciado há menos
   de 60 s (o pior caminho vivo da action é conexão + POST + conexão, 35 s). **Um `enviando` mais
   velho que isso é GRAVADO como incerto na mesma instrução que o reivindica**
   (`incerto_pendente = incerto_pendente or envio_estado = 'enviando'`, com o valor antigo da
   linha), antes de o passo 4 decidir o corpo. Na mesma instrução, **um corpo liberado é apagado**
   (sem incerteza e sem envio em andamento, ele é só o que o operador abandonou), e `tentativas`
   sobe e vira a **ficha** deste envio: toda escrita seguinte a exige, e a que não achar a linha
   devolve `superado` sem gravar nada por cima do envio que assumiu. Ler como incerto só na tela não basta: se
   o processo morreu entre o POST e a gravação do desfecho, ou se a gravação falhou (o pooler já
   morreu por falta de vaga, `testes-integracao/banco-descartavel.ts:112-116`), sobraria
   `incerto_pendente` falso e o corpo solto.
3. Valida os campos revisados contra as regras **do contrato** (slug 3–90 `a-z 0-9 -`, título
   3–220, descrição 8–1200, prompt 20–20 000, intro ≤ 4 000), para o Labs nunca recusar por culpa
   nossa. A palavra segue uma regra **mais estreita** que a do contrato (≤ 80): o Chat a
   normaliza como o Labs (sem acento, maiúscula), aceita só letras e números, de 3 a 30, e mostra
   ao operador a forma que vai ser gravada. Mais estreita é seguro, e deixa simples casar a
   palavra com a automação na Etapa 5.
4. Decide o corpo (ver "O congelamento"): reusa `corpo_enviado` ou serializa **uma vez** e grava.
5. Assina **a string gravada**, com `t` em segundos, **agora**. A assinatura é refeita a cada
   envio; guardá-la faria um reenvio depois de 5 minutos voltar `401 timestamp_fora_da_janela`.
6. Envia exatamente essa string, lê a resposta e grava o desfecho.

**O que cada resposta vira** (função pura). "Com incerta" significa que `incerto_pendente` é
verdadeiro: uma tentativa anterior terminou sem que o Chat soubesse o desfecho.

| resposta | sem incerta antes | com incerta antes |
|---|---|---|
| 201 | `criado`: "Criado no Labs, oculto", o link que vai existir e o passo seguinte | `criado` |
| 200 `duplicate` | `colisao`: "já existe no Labs um bônus com esse endereço e esse título, que não saiu deste envio; confira antes, e para um bônus diferente mude o título e o slug". Libera | com `id` (contrato de 29/09: slug e título iguais): **`criado`**, é o nosso, e o `id` fica gravado. Sem `id` (contrato antigo, que olhava só o slug): **`conferir`** |
| 409 `slug_ocupado` | `colisao`: "o endereço é de outro bônus, com outro título; troque o slug". Libera | **`conferir`**: alguém pode ter mudado o título do nosso no `/admin` entre o timeout e o reenvio |
| 409 `titulo_repetido` com `slugExistente` = o nosso slug | `criado`: é o nosso | `criado`: é o nosso, a tentativa incerta terminou no meio desta |
| 409 `titulo_repetido` com outro slug | `recusado`: "o bônus X já tem esse título". Libera | igual, e libera: o mesmo título teria barrado a tentativa incerta |
| 409 `palavra_chave_repetida` | `recusado`: "a palavra X já leva a outro bônus". Libera | **`conferir`**: pode ser a nossa tentativa incerta |
| 422 (campos, tema, ausentes) | `recusado`: o problema de cada campo, ou a lista `temasValidos` para escolher. Libera | **`conferir`**: a checagem vem antes da do slug e **não é determinística no tempo**. O catálogo muda (o `/admin` do Labs renomeia e apaga tema, `admin/temas/actions.ts:124` e `:165`), então a tentativa incerta pode ter passado e criado |
| 413 | `recusado`: passou de 64 000 bytes. Libera | **`conferir`**, pelo mesmo motivo: vem antes do slug, e a regra é do código do Labs, que vai mudar |
| 401 `timestamp_fora_da_janela` | `recusado`: relógio deste servidor fora de sincronia. Libera | `recusado`, e **continua congelado**: a tentativa incerta pode ter tido o relógio certo |
| 401 outros | `recusado`: segredo diferente nos dois lados. Libera | igual, e continua congelado |
| 429 | `esperar`: "o Labs pediu para esperar 60 s", e o botão de reenviar | igual |
| 503 | `porta_desligada`: "a porta do Labs está desligada; avise quem cuida do Labs" | igual |
| 500, timeout, rede, 400, status ou corpo fora do contrato | `incerto`: "não sabemos se chegou; reenviar é seguro: vai o mesmo conteúdo, com o mesmo slug". Congela | igual |

**`conferir`: o caso em que só uma pessoa sabe a resposta.** A tela diz: *"Pela resposta do Labs
não dá para saber se o bônus foi criado. Abra o /admin do Labs e procure o slug `<slug>`."* Com
dois botões, cada um uma action com conferência de sessão:

- **"Existe, com o título `<título>`"**: vira `criado`, com `conferido_pelo_operador` verdadeiro;
- **"Não existe"**: `incerto_pendente` volta a falso, o corpo é liberado, e o próximo envio dá a
  resposta definitiva.

**Por que existe ambiguidade.** São três as fontes, todas lidas em `site-ia/src/app/api/bonus/route.ts`
(commit `1813fd0`) e conferidas pelo auditor:

1. **A duplicata é decidida só pelo slug** (184-190), e a resposta não traz o `id`. Uma colisão com
   bônus alheio e a nossa própria tentativa respondem igual.
2. **A corrida.** A tentativa incerta pode ainda estar rodando no Labs quando o reenvio chega. O
   reenvio passa pela checagem de slug antes de ela gravar, e depois bate no título (192) ou na
   palavra (203), que agora são os nossos.
3. **Violação de unicidade de qualquer índice vira duplicata** (271-272, sem olhar `meta.target`),
   e `Bonus` tem dois índices únicos: slug (`schema.prisma:255`) e palavra (`:345`). Uma palavra
   igual que nasce no mesmo instante responde `duplicate` para um slug que **não existe**. Sem
   incerta antes, isso aparece como `colisao`: troca-se o slug, e o reenvio revela a palavra
   repetida, com o diagnóstico certo.
4. **As checagens anteriores ao slug não são determinísticas no tempo.** O catálogo de temas
   muda pelo `/admin` do Labs, e o teto de tamanho é regra de código que pode mudar. Uma recusa
   dessas depois de uma tentativa incerta não prova que a incerta falhou.

Sem incerta antes, `isActive` não muda nada. Com incerta antes, `isActive: true` também é ambíguo:
alguém pode ter publicado o nosso bônus no /admin entre o timeout e o reenvio.

**A ordem da rota**, de onde saem as regras: limitador (82) → tamanho (92, 105) → assinatura (112)
→ JSON (132) → campos (137) → tema (148, 152) → palavra ausente (171) → **slug** (184) → título
(192) → palavra repetida (203) → criação.

**O congelamento.** Corpo congelado significa os mesmos bytes, com os campos só para leitura e o
motivo na tela. **Liberar** significa duas coisas juntas: o corpo volta a ser editável, e o
próximo envio serializa de novo, e `incerto_pendente` volta a falso, porque toda resposta que
libera prova que nenhuma tentativa desta linha criou o bônus.

- um desfecho **incerto** congela e põe `incerto_pendente` em verdadeiro, e um `enviando` velho
  reivindicado também;
- **liberam:** sem incerta antes, toda recusa (colisão, 401, 409, 413, 422); com ou sem incerta, o
  409 de título com outro slug; e "Não existe" na conferência;
- **mantêm congelado:** com incerta antes, 401, 413, 422, 409 de palavra e duplicate (os quatro
  últimos em `conferir`); e 429 e 503, que não mudam nada;
- `criado` encerra o envio.

**A regra por trás da lista:** com incerta antes, só libera a resposta que vem **depois** da
checagem de slug (184) e aponta para outro dono. Tudo o que vem antes dela não diz nada sobre a
tentativa incerta, e aí quem decide é uma pessoa olhando o `/admin`.

**O conserto no Labs, fora deste repositório.** Decidido pelo Eduardo em 29/09: uma etapa
pequena no site-ia em que (a) a duplicata só vale quando slug **e** título coincidem (sem
distinguir maiúscula), senão 409 `slug_ocupado`; (b) a violação de unicidade lê `meta.target`, e
a do índice da palavra vira 409 `palavra_chave_repetida`; (c) o contrato e o `bonus:prova`
acompanham. Com isso as fontes 1 e 3 somem, e `conferir` fica só para a corrida e para as
recusas anteriores ao slug depois de uma tentativa incerta.

**Feito no site-ia em 29/09** (`d582f3c`, e `485573e` no contrato): o `duplicate` traz o `id`, e
índice inesperado no P2002 vira `500 erro_temporario`, que aqui já é `incerto`. O contrato
passou a dizer só o fato ("já existe um bônus com esse slug e esse título"): quem sabe se houve
tentativa anterior é o Chat. O Chat lê as respostas novas desde a FASE 1.13, e o `duplicate` só
vira `criado` com o `id`, o que mantém no lado seguro uma resposta do contrato antigo.

**Ligar a porta**, nesta ordem (a produção do Labs, `dc7cafe`, ainda não tem o conserto): (1) o
deploy `dev` → `main` do Labs; (2) o `BONUS_INTAKE_SECRET` novo no Labs, na Hostinger; (3) o mesmo
segredo e a `LABS_URL` na Vercel do Chat. Até o passo 3, o Chat nem envia: recusa por falta de
configuração. Se alguém configurar o Chat antes do Labs, ele recebe 503 antes do passo 2 e 401
depois dele. Os dois já estão tratados, e nenhum grava bônus.

O `ALTER TABLE "Lead"` da Etapa 45 do Labs chegou a estar nesta ordem e saiu, conferido na fonte
em 29/09 (site-ia `e522754`): a coluna nova só é escrita por `registrarContatoDoBonus`, que não
tem chamador, e os outros usos de `Lead` (um `deleteMany` e um `count`) não a pedem. O SQL passa a
ser obrigatório quando a tela que chama essa função existir, e isso é do Labs.

### As telas

- **`/bonus`:** o formulário (tema com sugestões, o que resolve, palavra opcional), "restam N de
  5 hoje" e a lista das últimas gerações, com o estado da geração e o do envio.
- **`/bonus/[id]`:**
  - *gerando*: barras de carregamento e "leva de 30 s a 1 min". A tela pergunta o estado a cada
    2 s, uma pergunta de cada vez, e para quando a geração termina ou quando passa de
    `DESISTIR_MS`;
  - *travou / falhou*: o motivo escrito e "gerar de novo", que cria outra linha e conta no teto;
  - *pronto*: os campos editáveis com o limite do contrato e a contagem de caracteres, o botão
    "Enviar ao Labs" e o aviso fixo de que o bônus nasce oculto;
  - *depois do envio*: o desfecho da tabela acima. No sucesso, o link
    `<LABS_URL>/bonus/<slug>` com botão de copiar e a instrução: *publique no /admin do Labs; só
    então ponha o link numa automação.*

Toda action sai por `redirect` com aviso, e o texto de cada saída vem de função pura: o padrão
"nenhuma saída muda" do dono (`app/publicar/actions.ts`). O texto de tela passa pelo `humanizer`.

**Sugestões de tema.** Os temas distintos do `GET <LABS_URL>/api/bonus`, lidos a cada render, com
teto de 3 s. Sem cache: as páginas são `force-dynamic`, o padrão do dono, e isso põe `no-store`
em todo `fetch` da página. Se a leitura falhar, o campo fica sem sugestões e nada mais para. ⚠️ **Essa leitura não está no
contrato** (está na rota); se ela mudar, só as sugestões somem.

### Configuração

| variável | quem usa | sem ela |
|---|---|---|
| `ANTHROPIC_API_KEY` | a geração | gerar é recusado com a mensagem certa |
| `BONUS_INTAKE_SECRET` | o envio | enviar é recusado; gerar continua |
| `LABS_URL` | o envio e as sugestões | idem. Só `https`, exceto `localhost` e `127.0.0.1` para a prova local |

Falha fechada nas três: nenhuma libera por omissão.

---

## Segurança

- **Acesso:** toda action confere `isValidSession`, além do `proxy.ts`. As actions existentes do
  projeto confiam só no proxy; as desta feature não.
- **Injeção:** SQL só parametrizado. O que o operador digita vai na mensagem do usuário, nunca no
  `system`, com teto de tamanho no servidor. A saída da IA passa pelo schema e aparece como
  texto, nunca como HTML.
- **Segredo:** nunca em banco, log, tela, commit ou mensagem de erro. O cabeçalho de assinatura
  não é gravado.
- **Resposta do Labs é entrada hostil:** o corpo é lido até 16 KB e o que passar disso é
  `incerto`; só os campos conhecidos do contrato são guardados.
- **Custo:** 5 gerações por dia, timeout nas duas chamadas externas, `maxRetries: 0`.
- **Antes de cada commit:** `scan-secrets` e `security-review`, e a varredura de caractere de
  controle e de quebra de linha misturada nos arquivos tocados.

---

## Testes

Cada teste é escrito antes do código e, para os marcados, mostra-se que ele **falha** quando a
proteção é retirada.

| suíte | caso | falha se… |
|---|---|---|
| pura | a assinatura confere com o HMAC recalculado sobre o corpo que o `fetch` recebeu | o JSON for serializado duas vezes |
| pura | `t` em segundos: \|t − agora/1000\| < 300 | alguém usar `Date.now()` cru |
| pura | reenvio com relógio forjado 6 min à frente: `t` novo, corpo idêntico (proposto pelo auditor) | a assinatura for guardada |
| pura | cada linha da tabela de respostas, nas duas colunas (sem e com incerta antes) | duplicate virar sucesso sempre |
| pura | sequência [timeout, 409 `titulo_repetido` com `slugExistente` = o nosso] termina em `criado` (proposto pelo auditor) | o 409 liberar sempre |
| pura | sequência [timeout, 409 `palavra_chave_repetida`] termina em `conferir`, com o corpo congelado | idem |
| pura | sequência [timeout, `duplicate` com `isActive: true`] termina em `conferir`, e não em `colisao` | `isActive` decidir sozinho |
| pura | sequência [timeout, 422 `tema_fora_do_catalogo`] termina em `conferir`, com o corpo congelado (proposto pelo auditor) | alguém tratar o 422 como determinístico |
| pura | o congelamento: incerta → 401 continua congelado; "Não existe" libera | o corpo mudar depois de incerta |
| pura | a ordem dos relógios | alguém mexer num número só |
| pura | linha travada com relógio forjado; o teto diário; a palavra digitada vencendo a da IA; a validação contra o contrato | — |
| integração (**só no container**, com `DATABASE_URL_TESTES`) | a `013` cria a tabela com as restrições; o teto conta no relógio do banco; dois processamentos da mesma linha chamam a IA uma vez (dublê da IA) | — |
| integração | pedidos simultâneos com 4 linhas no dia: só 1 entra | a trava sair da transação |
| integração | linha em `enviando` há 61 s, `incerto_pendente` falso, corpo X; envio com o slug editado para Y e resposta `200 duplicate`: o Labs recebe X e o estado final é `conferir` (proposto pelo auditor) | a reivindicação não gravar a incerteza |
| integração | A recebe 429 em 300 ms; a reserva de A envelhece; B assume e recebe 201 em 600 ms: o final é `criado`, e A devolve `superado` (proposto pelo auditor) | a ficha sair das escritas do envio |
| integração | corpo A recusado, operador edita para B, uma reserva morre antes de gravar o corpo: o envio seguinte leva B (proposto pelo auditor) | a reserva não apagar o corpo liberado |
| integração | o teste segura a trava do teto numa transação própria: o pedido perde para um relógio de 300 ms | a trava sair de `criarPedido` |
| todas | cada arquivo novo casa com o `include` da sua suíte (`tests/**/*.test.ts`, `testes-integracao/**/*.integracao.ts`, `testes-dom/**/*.dom.tsx`). A prova é a contagem subir acima da base de 29/09: 54 arquivos / 1 891 casos puros, 9 / 64 de tela | o arquivo não rodar em suíte nenhuma |
| integração | o envio contra um dublê HTTP em `127.0.0.1`: timeout na 1ª, e a 2ª leva o mesmo slug e o mesmo corpo | — |
| tela | o acompanhamento para quando a geração termina e nunca sobrepõe pedidos | — |

⚠️ **A suíte de integração nunca roda sem `DATABASE_URL_TESTES`.** Ela anuncia, contra o
container, *"Rode sem DATABASE_URL_TESTES antes do merge"* (`testes-integracao/rede-global.ts:39-41`),
e obedecer isso a faz rodar na produção. Os dois arquivos que pulam no container (`fundacao` e
`esquema-base`) ficam registrados no PR como não rodados; rodá-los é decisão do Eduardo ou do dono.

---

## A prova real, antes do merge

Cada passo que grava só acontece depois de avisar o Eduardo e ter o OK dele.

1. O Eduardo põe a `ANTHROPIC_API_KEY` no `.env.local`. O valor não passa por esta sessão.
2. Ensaio a seco de `scripts/migrar.mjs --a-mao`. Ele **conecta na produção do Chat** (a
   `DATABASE_URL` do `.env.local`), só para ler. Se aparecer **qualquer** migração além da `013`,
   para aqui e volta ao Eduardo. Se for só a `013`, e com o OK dele, `--aplicar --a-mao`, que
   **grava na produção do Chat**. A prova vai ao Labs local; a tabela, não.
3. O Labs sobe local, combinado com as sessões do site-ia. `LABS_URL` e o segredo local entram no
   `.env.local` do Chat sem serem impressos.
4. Uma ou duas gerações reais (centavos de dólar cada; o custo exato sai de `medicao`),
   conferidas contra a régua do Labs: prompt de 700 a 1 200 caracteres, sem bloco
   "PREENCHA ANTES DE RODAR", sem atos premium. Também é medido o tempo real da geração.
5. O envio: 201, bônus oculto no `/admin` do Labs local e `/bonus/<slug>` respondendo 404 lá.

### O que a prova mediu, em 29/09

Cada escrita foi feita com o OK do Eduardo.

- **A tabela:** o ensaio a seco listou só a `013` (da `000` à `012`, já aplicadas, e todas as
  conferências do dono passando). Aplicada com `--aplicar --a-mao`, e o ensaio seguinte deu
  "`013` já aplicada".
- **O Labs local:** site-ia na branch `dev` (`c7be639`), com banco local (`site-ia-db`). Nada foi
  para a produção do Labs.
- **A geração:** 27,3 s do pedido ao bônus pronto, com `claude-opus-5-5`: 3 179 tokens de
  entrada, 2 252 de saída, sem cache. O prompt saiu com 1 041 caracteres, dentro da régua, e sem
  "preencha". A palavra digitada, `ZZPROVA`, venceu a sugerida pela IA (`LEGENDA`).
- **O envio:** `POST /api/bonus` 201 em 99 ms no Labs, e 0,2 s do lado do Chat, criado na
  primeira tentativa. No Labs o bônus ficou com `isActive = false`, `/bonus/<slug>` respondeu 404
  e ele não apareceu no `GET /api/bonus`.
- **O defeito achado:** o prompt chegou ao Labs com 1 062 caracteres, contra 1 041 na tela: as 21
  quebras de linha foram como `\r\n`, porque o navegador manda todo textarea assim. Corrigido no
  Chat na FASE 1.11-bis: os dois leitores de formulário voltam a quebra para `\n` antes de contar e
  de assinar. No Labs local, 7 dos 57 bônus já tinham `\r`, provavelmente os editados pelo
  `/admin`; isso é do Labs.
- **A limpeza:** a linha de prova foi apagada da produção do Chat (1 linha, por id, slug e
  palavra), e a tabela ficou vazia. O bônus de prova do Labs local foi pedido à sessão do site-ia,
  por slug exato. As linhas `LABS_URL` e `BONUS_INTAKE_SECRET` saíram do `.env.local`, e os dois
  servidores locais foram desligados.

**O que esta prova não mede.** O tempo do envio contra a produção do Labs: lá, o `POST` faz seis
idas em série ao banco (informado pela sessão do site-ia), e o banco remoto responde mais devagar
que o local. O teto de 15 s é provavelmente folgado, mas só vai ser medido quando a porta for
ligada na produção. Se estourar, o envio vira "incerto", e o reenvio leva o mesmo corpo.

---

## Pré-condições do merge

1. **Fluid Compute ligado**, conferido pelo Eduardo na tela da Vercel. Sem ele, o
   `maxDuration = 300` pode derrubar o build de produção da `main`. **Cumprida em 29/09:** o
   Eduardo viu a chave ligada em Settings → Functions, e o plano do time é **Hobby** (teto de
   300 s por função, o mesmo número das páginas do bônus).
2. `ANTHROPIC_API_KEY` criada na Vercel (production).
3. `npm run verify` limpo, e a suíte de integração verde no container.
4. `BONUS_INTAKE_SECRET` e `LABS_URL` **não** são pré-condição: sem elas o envio recusa com a
   mensagem certa. Ligar a porta nos dois lados é o passo seguinte ao merge, como o contrato
   manda.
5. PR com o porquê, revisado pelo dono. Nada é empurrado na `main`.
6. Nenhum `next dev` apontado para a produção durante o deploy do merge. O build aplica migração,
   e um leitor preso numa transação derruba o deploy aos 120 s (`scripts/migrar.mjs:383-390`).

---

## Fora do escopo, anotado e não mexido

Achados de 29/09 que não são desta feature. Ficam para o dono.

- `/api/cron/daily` fica **aberta** quando `CRON_SECRET` falta (`route.ts:17-18`, e `/api/cron`
  está em `PUBLIC_PREFIXES`), e ele não existe na Vercel.
- Sem QStash e sem `CRON_SECRET`, `/api/queue/tick` responde sempre 401: posts agendados e
  lembretes só saem quando chega webhook ou no cron diário.
- As Server Actions do projeto conferem a sessão só pelo `proxy.ts`.
- O README diz Neon e esquema criado pelo `lib/db.ts`; os dois mudaram.
- O time da Vercel está no plano Hobby, que os termos da Vercel restringem a uso não comercial.
  O painel atende um negócio. Não bloqueia esta feature, mas a decisão de plano é do dono.
- Na prova real, com o `next dev` local apontado para a produção, apareceu
  `57014 canceling statement due to statement timeout` como `unhandledRejection`, sem requisição
  ligada, logo depois de uma recarga por edição de arquivo. O `statement_timeout` da produção é de
  2 min, e logo depois não havia nenhuma sessão ativa. A consulta não foi identificada. A hipótese,
  não medida, é uma instrução esperando trava, da mesma família que `scripts/migrar.mjs:383-390`
  registra. Para investigar, com o dev no ar: `pg_stat_activity` com
  `state like 'idle in transaction%'` e `pg_locks where not granted`.
