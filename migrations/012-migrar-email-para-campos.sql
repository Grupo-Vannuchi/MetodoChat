-- O QUE JÁ EXISTE EM PRODUÇÃO ENTRA NO FORMATO NOVO — e esta é a PRIMEIRA
-- migração desta pasta que mexe em DADO, e não em estrutura.
--
-- Todas as onze anteriores acrescentam coluna, tabela ou restrição, e por isso
-- são conferidas perguntando ao catálogo do Postgres "isto existe?". Esta não
-- cria nada: ela reescreve linhas. Quem a confere é `ESPERADAS_DADOS`
-- (scripts/migrar.mjs), a quinta lista daquele arquivo, nascida deste arquivo
-- exatamente como a segunda nasceu da `003` e a quarta da `004`/`005`. Em
-- `lib/esquema.ts` ela entra como NÃO OBSERVÁVEL, com o motivo escrito lá.
--
-- E É A PRIMEIRA QUE NÃO RODA DENTRO DO BUILD, pela mesma razão de ser a
-- primeira que mexe em dado. Ver o bloco seguinte.
--
-- -----------------------------------------------------------------------------
-- ELA NÃO É MAIS BLOQUEANTE, E NÃO RODA DENTRO DO BUILD (23/09/2026)
--
-- ESTE PARÁGRAFO DIZIA O CONTRÁRIO, e a correção fica escrita porque foi ela
-- que mudou a ordem do deploy. Ele afirmava: "`conferir` (lib/steps.ts) passou
-- a RECUSAR o tipo `pedir_email` (…) Publicar a branch sem rodar isto deixa um
-- bloco que `interpretar` IGNORA. O fluxo passa por cima do pedido e entrega o
-- que vem DEPOIS dele — o link inclusive — sem nunca ter pedido nada."
--
-- Era verdade, e era METADE da história. A outra metade é o espelho: enquanto o
-- deploy não é promovido, quem atende o webhook é o código ANTERIOR — e ele faz
-- a MESMA coisa com o passo JÁ MIGRADO ("tipo desconhecido: pedir_dado"). Como
-- esta migração roda no COMEÇO do `next build`, era exatamente esse par que
-- ficava no ar durante todo o build, e por tempo indeterminado se o build
-- falhasse. A janela vazava o link nas DUAS direções.
--
-- O CONSERTO, e é ele que tira a urgência daqui: `conferir` passou a aceitar
-- `pedir_email` como APELIDO de `pedir_dado { campo: "email" }`, traduzindo na
-- leitura — a MESMA tradução que o `case` lá embaixo faz. Com isso o código
-- novo serve dado velho, os dois formatos valem ao mesmo tempo, e esta migração
-- deixa de ser destravamento e vira LIMPEZA DE FORMATO.
--
-- POR ISSO ELA SAIU DO BUILD. `SO_A_MAO` (scripts/migrar.mjs) a adia em todo
-- deploy; ela é aplicada à mão depois, com o código novo já no ar. O
-- procedimento está em `docs/deploy/2026-09-23-a-012-sai-do-build.md`.
--
-- O QUE CONTINUA VERDADE: enquanto ela não rodar, o formato velho continua no
-- banco e o apelido continua sendo necessário. Quem responde "já rodou?" é
-- `ESPERADAS_DADOS` (scripts/migrar.mjs), e é ela que volta a derrubar o deploy
-- se sobrar alguma coisa DEPOIS de a migração estar registrada.
--
-- -----------------------------------------------------------------------------
-- POR QUE O `em` É O PRIMEIRO CONTATO, E NÃO UMA DATA RECENTE
--
-- `campoEstaFresco` (lib/campos.ts) decide se a automação PULA o pedido, e ela
-- compara o `em` com o relógio de quem lê. Não existe data de coleta guardada
-- para estes e-mails: o dado sempre viveu como coluna solta, sem quando nem
-- quem. `first_contact_at` é o que se sabe — é o limite superior honesto, o
-- e-mail não pode ter sido coletado antes de a pessoa falar a primeira vez.
--
-- Chutar uma data recente seria pior do que não saber: faria a recência PULAR o
-- pedido justamente para quem talvez precise ATUALIZAR o e-mail. A consequência
-- aceita, por escrito, é a outra ponta — quem tem e-mail antigo vai ser
-- perguntado de novo. É o mesmo lado seguro que `campoEstaFresco` já escolhe
-- para data ilegível e para data no futuro: perguntar de novo, nunca pular.
--
-- `automacao` NÃO É GRAVADO pelo mesmo motivo: não há origem guardada. A chave
-- é opcional em `CampoColetado` (lib/campos.ts) desde a `011`, e o comentário
-- daquela migração diz que a opcionalidade existe para ESTES contatos. Gravar
-- `'automacao', null` teria o mesmo efeito e diria uma coisa a mais que não se
-- sabe; a ausência da chave é a forma honesta de "não sei".
--
-- -----------------------------------------------------------------------------
-- ESTA MIGRAÇÃO NÃO LEVA `account_id`, e é a única coisa desta fase que não leva
--
-- A regra "toda consulta leva `account_id`" existe para o código que ATENDE uma
-- requisição: lá sempre há uma conta pedindo, e esquecê-la vaza dado de um
-- cliente para outro. Aqui não há conta pedindo — a migração roda dentro do
-- build, uma vez, sobre o banco inteiro, e escopá-la por conta significaria
-- deixar as outras para trás. Filtrar por conta aqui é que seria o defeito.

-- =============================================================================
-- PASSO 1 — OS DADOS DOS CONTATOS
--
-- `campos || jsonb_build_object(...)` MESCLA, E NÃO SUBSTITUI, e essa é a linha
-- mais importante deste arquivo. É o mesmo `||` de `gravarCampo`
-- (lib/engine.ts), pelo mesmo motivo escrito lá: trocando por
-- `set campos = jsonb_build_object(...)`, um contato que já tenha telefone ou
-- nascimento coletados e ainda não tenha e-mail perde o que tinha — o `where`
-- abaixo pergunta só pelo e-mail e deixa esse contato passar.
--
-- No dia do deploy `campos` está vazio para todo mundo (a coluna nasceu na
-- `011`), e nesse dia os dois dariam o mesmo resultado. É na SEGUNDA execução —
-- um banco restaurado de backup, um schema remontado, a suíte de integração que
-- aplica a pasta inteira a cada rodada — que o `=` destrói dado. MEDIDO: com
-- `jsonb_build_object` sozinho, um contato com telefone coletado sai daqui só
-- com o e-mail.
--
-- `btrim(email) <> ''` É O QUE SEPARA "TEM E-MAIL" DE "TEM A COLUNA PREENCHIDA".
-- `email is not null` sozinho deixa passar a string vazia, e o resultado seria
-- um campo que o sistema AFIRMA ter coletado e que não tem valor nenhum —
-- `{{email}}` sairia vazio numa mensagem com cara de preenchida. A coluna não
-- tem `check` de conteúdo. O valor gravado é o `email` CRU, e não o aparado: a
-- coluna continua sendo lida por seis lugares até a Parte 2, e gravar aqui uma
-- versão diferente da que está lá criaria duas verdades sobre o mesmo e-mail.
--
-- `not (campos ? 'email')` É A METADE DA REEXECUÇÃO que olha para o destino: o
-- que já foi migrado (ou coletado de verdade depois) não é tocado de novo, e o
-- dado NOVO nunca é sobrescrito pelo VELHO da coluna. O operador `?` não estoura
-- em nenhum tipo de jsonb — medido: `null`, escalar e array devolvem false.
--
-- `at time zone 'utc'` NÃO É ENFEITE, E FOI MEDIDO CONTRA ESTE POSTGRES.
-- `first_contact_at` é `timestamptz`, e `to_char` sem conversão imprime no fuso
-- da SESSÃO — enquanto o `"Z"` do formato é texto literal, colado no fim
-- aconteça o que acontecer. Com a sessão em `America/Sao_Paulo`, um contato de
-- `2026-06-10 12:00+00` sairia como `2026-06-10T09:00:00Z`: uma string que
-- mente três horas e que `Date.parse` (dentro de `campoEstaFresco`) acredita.
-- O formato é o mesmo que `gravarCampo` (lib/engine.ts) grava hoje, e tem de
-- ser: duas formas para o mesmo campo seriam duas verdades sobre o que o JS lê.
-- =============================================================================

update contacts
   set campos = campos || jsonb_build_object('email', jsonb_build_object(
         'valor', email,
         'em', to_char(first_contact_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))
 where email is not null
   and btrim(email) <> ''
   and not (campos ? 'email');

-- =============================================================================
-- PASSO 2 — OS PASSOS DAS AUTOMAÇÕES
--
-- O ALVO É ESCOLHIDO POR CONTENÇÃO (`@>`), E NÃO POR `steps::text like
-- '%pedir_email%'`. A troca fecha TRÊS buracos de uma vez, e os três foram
-- medidos contra este Postgres:
--
--   1. O `like` casa a automação cuja MENSAGEM contém a palavra — "o bloco
--      pedir_email saiu da paleta" é texto de DM, não é passo nenhum. O `case`
--      não reescreveria nada, mas a LINHA seria regravada à toa, numa tabela de
--      produção, dentro do build. Com `@>`, ela nem entra no `update`.
--
--   2. O `like` casa `steps` que NÃO É ARRAY — um objeto `{"tipo":
--      "pedir_email"}`, um escalar `"pedir_email"`. Aí `jsonb_array_elements`
--      estoura com `cannot extract elements from an object` / `...from a
--      scalar`, e não é uma linha que falha: é o comando inteiro que aborta, e
--      com ele o `next build` e o deploy. A coluna é `jsonb not null default
--      '[]'` e não tem `check` de forma — `conferirLista` (lib/steps.ts) já
--      trata "A automação não tem lista de blocos", ou seja, a base admite que a
--      linha torta existe. `@>` com um ARRAY do lado direito só dá true para
--      array, e nunca estoura em tipo nenhum.
--
--   3. `jsonb_agg` sobre zero linhas devolve NULL, e `steps` é `not null` — um
--      alvo sem elementos derrubaria o `update` inteiro. Com `@>` isso é
--      IMPOSSÍVEL por construção: só casa quem tem pelo menos o elemento
--      procurado. É por isso que não há `coalesce` aqui: uma guarda que nenhum
--      caminho alcança é pior que a ausência dela, porque o próximo leitor vai
--      procurar quem a lê.
--
-- `(p - 'tipo') || jsonb_build_object(...)` PRESERVA O RESTO DO PASSO — o `id`
-- (que liga as setas e é o que o cursor de quem está no meio da conversa
-- guarda), o `texto` (que é o que a pessoa lê, e sem o qual `conferir` recusaria
-- o bloco por "pedir_dado sem texto") e a `pos` (o desenho do quadro). O lado
-- direito do `||` ganha, então `tipo` vira `pedir_dado` e `campo` vira `email`
-- mesmo que já houvesse um `campo` gravado.
--
-- O `ORDER BY ord` FICA, E NENHUM TESTE O ALCANÇA — e está escrito assim porque
-- a alternativa era um comentário que promete mais do que se mediu.
--
-- O que ele defende é real: sem setas desenhadas, a ORDEM DO ARRAY É o fluxo
-- (`interpretar`, lib/steps.ts), e o Postgres NÃO documenta ordem nenhuma para
-- a entrada de um agregado sem `order by`. Mas isso é contrato, não
-- comportamento: MEDIDO neste container, tirando o `order by ord` a saída
-- continua idêntica, com 3 e com 50 elementos — `jsonb_array_elements` emite na
-- ordem do array, `jsonb_agg` consome na ordem em que recebe, e sobre UMA linha
-- não há plano paralelo que embaralhe. O plantio foi feito e a suíte inteira
-- ficou VERDE.
--
-- Ou seja: o caso "na MESMA ordem" (testes-integracao/migracao-dos-dados-
-- legados.integracao.ts) prova que a migração preserva a ordem, e NÃO prova que
-- é esta cláusula que a preserva. Quem for mexer aqui não tem rede — tem a
-- documentação do Postgres, que é o motivo de a cláusula existir.
--
-- REEXECUÇÃO: depois desta passada nenhum elemento tem `tipo = 'pedir_email'`,
-- então o `@>` não casa mais e a segunda execução não toca em linha nenhuma.
-- =============================================================================

update automations
   set steps = (
     select jsonb_agg(
       case when p->>'tipo' = 'pedir_email'
            then (p - 'tipo') || jsonb_build_object('tipo', 'pedir_dado', 'campo', 'email')
            else p end
       order by ord)
     from jsonb_array_elements(steps) with ordinality as t(p, ord))
 where steps @> '[{"tipo": "pedir_email"}]'::jsonb;
