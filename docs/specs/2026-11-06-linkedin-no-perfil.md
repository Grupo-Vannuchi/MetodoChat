# O LinkedIn no perfil pessoal (ponto 2, a primeira rede)

**Nascido em:** 06/11/2026, sobre a `main` em `56cd72a` (o PR #30, as contas por login, em produção desde 06/11), do ponto 2 dos feedbacks do Vinícius (19/10): publicar em várias redes.

**O que o Eduardo decidiu pela caixa, em 06/11/2026:**
- **uma rede de cada vez**, cada uma com spec, plano e prova próprios. A primeira é o **LinkedIn**. YouTube, X e TikTok ficam para depois (a comparação das quatro está em "O que as redes exigem", abaixo);
- **o perfil pessoal primeiro**. A página de empresa vem numa entrega seguinte, porque depende de uma análise do LinkedIn;
- **os quatro formatos** na primeira entrega: imagem com texto, só texto, carrossel e vídeo;
- **o carrossel vai como documento PDF**, o "carrossel do LinkedIn" que a pessoa passa com a seta;
- **as redes se marcam no mesmo post**: caixinhas "Instagram" e "LinkedIn" na tela de publicar e no carrossel do gerador, com o mesmo conteúdo, o mesmo horário e o andamento separado por rede;
- **o texto**: vai a legenda, com um campo opcional "Texto para o LinkedIn";
- **a conexão é pelo link de convite**, porque quem autoriza é o dono do perfil, com o login dele no LinkedIn;
- **o app do LinkedIn quem cria é o Eduardo**, com um passo a passo; as chaves ficam só nas variáveis da Vercel;
- **o caminho técnico é o A**: o painel fala direto com o LinkedIn, e a publicação entra na fila como mais um destino. Os outros dois caminhos oferecidos, recusados: um serviço de terceiros que publica em todas as redes (mensalidade, dependência e os dados dos clientes passando por outra empresa) e a publicação na hora, fora da fila (sem agendamento, e o vídeo grande estouraria o tempo da Vercel);
- **o desenho abaixo foi aprovado** em três partes: a conexão e o convite; a publicação na fila; e as telas, o que fica de fora e o teste antes do código.

**A emenda de 09/11/2026** (decisões do Eduardo pela caixa, depois da sonda):
- **a sonda rodou** em 09/11 e as três reservas (documento, vídeo e imagem) responderam 200: a entrega segue como desenhada, inclusive o carrossel em PDF. A ferramenta de token do portal deu erro, e o token de teste saiu de um script de troca, conferido pela auditoria antes de rodar. A troca devolveu o `scope` separado por vírgula ("openid,profile,w_member_social") e um `id_token`;
- **a entrega vai em três partes**, cada uma com plano, prova e PR próprios:
  1. **a conexão**: a 024, só com a `linkedin_conexoes` e a rede e a conta-alvo do convite (§1, sem o tipo da fila); o repositório e a regra de acesso (§2); o convite e a volta (§3); a troca do código e o `userinfo` (§4); o vencimento (§5); a Configuração, a privacidade e a exclusão de dados (§7);
  2. **a publicação de "só texto" e de imagem**: a 025, que alarga o `queue_kind_check` com o `publicacao_linkedin`, junto com o ramo do dreno que sabe drenar a linha (o `tests/fila-tipos.test.ts` prende a lista do dreno à última migração que escreve o check); o resto do §4, do §5 e do §6; as telas de publicar, do calendário e do post (§7);
  3. **o carrossel em PDF e o vídeo em partes**, com a caixinha do LinkedIn no carrossel do gerador.
- **o "Desconectar" não revoga no LinkedIn** (achado 206): a documentação não traz endpoint de revogação, e a lista de serviços permitidos do LinkedIn não mostrou a autorização que existia. O "Desconectar" apaga a autorização do painel e para de usá-la; no LinkedIn, ela vence sozinha em até 60 dias. A tela e as páginas de privacidade dizem isso.

Onde o texto abaixo diz "a 024" para o tipo da fila, leia "a 025".

---

## O que existe hoje (medido no `56cd72a`)

- **A conta do painel é a conta do Instagram.**
  - A tabela `accounts` (`migrations/000-esquema-base.sql:227`) tem a chave `ig_user_id` e um token só. O token fica em texto puro, protegido pelo RLS ligado e sem permissão para `anon` e `authenticated`.
  - O tipo `Account` diz isso no comentário (`lib/db.ts:215`), e o `upsertAccount` grava pela chave do Instagram (`lib/db.ts:429`).
  - Quem vê qual conta é decidido num lugar só: `contasDoLogin` e `podeVerConta` (`lib/acesso.ts:20` e `:32`).
- **O convite liga um Instagram novo, e só.**
  - A tabela `convites_de_conexao` (`migrations/021-convites-de-conexao.sql:23`) não tem rede nem conta-alvo, e `criarConvite` recebe só o "para quem" (`lib/convites-repositorio.ts:32`).
  - O convite vira conta em `reivindicarEGravarConta` (`lib/convites-repositorio.ts:102`), que grava uma linha de `accounts`.
  - O `state` do OAuth e o convite vão em dois cookies, `metodochat_oauth_state` e `metodochat_oauth_convite` (`lib/auth.ts:15` e `:22`), conferidos antes de qualquer escrita (`app/api/oauth/callback/convite.ts:51`).
  - O endereço de volta é o canônico (`app/api/oauth/convite/[codigo]/route.ts:35`, com `canonicalAppUrl` em `lib/app-url.ts:58`): num preview, a volta iria para a produção.
- **A publicação é uma linha da fila do tipo `publicacao`.**
  - Quem enfileira é o `enqueuePublicacao` (`lib/engine.ts:2600`), chamado pela tela de publicar (`app/publicar/actions.ts:117`) e pelo carrossel do gerador (`lib/bonus/publicar-processo.ts:332`).
  - A chave contra duplicação é `pub:<conta>:<forma>:<caminhos>` (`lib/dedupe.ts:225`), sem a rede.
  - O payload (`lib/publicacao.ts:737`) não tem destino, e as formas são as do Instagram (`lib/publicacao.ts:95`).
  - O dreno publica pela mecânica de contêiner da Meta (`publicarDaFila`, `lib/queue-drain.ts:465`), apaga a mídia depois do `sent` (`lib/queue-drain.ts:607`) e trata o erro 4xx da Meta como permanente (`lib/queue-drain.ts:1251`).
  - A publicação fica fora da cota de DM da conta (`lib/queue-drain.ts:992` e `:1050`). O ramo dela começa em `lib/queue-drain.ts:1160`.
  - **O dreno pega qualquer linha pendente, sem olhar o tipo** (a seleção em `lib/queue-drain.ts:1036-1061`). Um tipo que ele não conhece cai no caminho das mensagens (`processItem`, `lib/queue-drain.ts:1168`).
  - As telas leem o andamento direto da fila, filtrando `kind = 'publicacao'` (`app/publicar/page.tsx:262` e `app/publicar/post/[id]/page.tsx:85`).
- **A conferência do build.** O `scripts/migrar.mjs` roda em todo deploy de produção. Ele exige o texto EXATO de cada restrição conferida, e o `queue_kind_check` esperado é o da 010 (`scripts/migrar.mjs:830-839`). Uma divergência é falha "NOS DOIS MODOS" (`:1043-1055`), e o script sai com código 1 (`:1312-1316`), o que derruba o build.
- **As mídias** ficam num bucket do Supabase, com leitura por URL pública, porque a Meta busca o arquivo (`lib/bucket.ts:189`). O teto é perguntado ao bucket a cada vez, e foi medido em 50 MB em 03/09/2026 (`lib/bucket.ts:303`); ele sobe sozinho se o plano do Supabase mudar.
- **Os testes** falam com um servidor HTTP falso na própria máquina. A base da Graph só se move sob duas travas: a variável de teste e o endereço de loopback (`baseDoGraph`, `lib/ig.ts:63`).

---

## O que as redes exigem (pesquisa de 06/11/2026, a conferir)

A pesquisa das quatro redes e a conferência do LinkedIn foram feitas por agentes com busca na web, em 06/11/2026. Elas estão fora do repositório, com o link de cada afirmação: `pesquisa-redes-06-11.md` e `linkedin-conferencia-06-11.md`, na pasta de trabalho do DEV. **É dado a conferir**: a sonda (abaixo) e o plano medem o que a entrega usar.

| | LinkedIn | YouTube | X | TikTok |
|---|---|---|---|---|
| Publica | texto, imagem, vídeo, documento PDF, várias imagens, artigo | só vídeo (Shorts até 3 min) | texto, até 4 imagens, vídeo | vídeo e fotos |
| Liberar | perfil: na hora; página: análise sem prazo | na hora até 100 usuários, com aviso de "app não verificado" | na hora | revisão e auditoria; ferramenta de agência listada como "Not acceptable" |
| Custo | não achada cobrança | grátis, com cota de 100 envios por dia por projeto | por uso: US$ 0,015 por post, US$ 0,20 com link | não achada cobrança |

**O LinkedIn, no que esta entrega usa** (fontes oficiais lidas em 06/11/2026; a data é a de atualização da página):
- **Liberação na hora.** O "Sign In with LinkedIn using OpenID Connect" (`openid`, `profile`) e o "Share on LinkedIn" (`w_member_social`) são "Open Permissions", adicionadas por autosserviço na aba Products ([Getting Access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access), 03/06/2026).
- **A página de empresa no cadastro do app.** O formulário pede a "LinkedIn Page", e a associação é permanente ([a1667239](https://www.linkedin.com/help/linkedin/answer/a1667239) e [a548360](https://www.linkedin.com/help/linkedin/answer/a548360), "há 2 meses"). A agência associa o app à página dela.
- **O token vale 60 dias**, e app comum não tem refresh token. A renovação é refazer o fluxo, e a tela de consentimento é pulada se o membro estiver logado e o token ainda não tiver vencido ([Authorization Code Flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow), 15/05/2026). Pedir um escopo diferente invalida os tokens anteriores (mesma página).
- **O autor** é `urn:li:person:{sub}`, com o `sub` do `GET /v2/userinfo` ([Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin), 14/12/2023; [OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2), 08/08/2024).
- **A API e a versão.** Base `https://api.linkedin.com/rest/`, com `Linkedin-Version: AAAAMM` obrigatório. A versão mais nova é a **202610**, com fim de suporte em **15/10/2027**; a 202511 sai em 16/11/2026 ([Versioning](https://learn.microsoft.com/en-us/linkedin/marketing/versioning), 14/10/2026). A `/v2/ugcPosts` é "Legacy", e a Posts API a substitui ([UGC Post API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/ugc-post-api), 17/09/2025).
- **Os formatos com autor pessoa:**
  - Documentos: `w_member_social`, dono pessoa, até 100 MB e 300 páginas, upload não síncrono, título obrigatório no post ([Documents API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/documents-api), 24/06/2026; [Post Schema](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/post-api-schema), 30/04/2026);
  - Vídeos: MP4, de 3 s a 30 min, de 75 KB a 500 MB, em partes ([Videos API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api), 02/03/2026);
  - Imagens: dono pessoa; um token só com `w_member_social` não lê `rest/images` ([Images API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api), 24/06/2026).
- **EM ABERTO: o documento PDF com só o "Share on LinkedIn".** As páginas das APIs novas pedem só o `w_member_social`, mas nenhuma afirma que um app só com o produto de autosserviço pode chamá-las, e a página do próprio produto documenta só texto, artigo, imagem e vídeo pela `/v2/ugcPosts`. Quem fecha isso é a sonda.
- **O texto** vai até 3.000 caracteres ([a528176](https://www.linkedin.com/help/linkedin/answer/a528176)), e no `commentary` os caracteres `| { } @ [ ] ( ) < > # \ * _ ~` vão com barra invertida antes ([little Text Format](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format), 16/10/2025).
- **Os limites** do "Share on LinkedIn": 150 requisições por membro por dia e 100.000 por app por dia (página do produto, 14/12/2023). Os 500 por app e 100 por membro do "Development tier" são da Community Management API, que esta entrega não usa.

---

## O teste antes do código (a sonda)

O plano começa por aqui, antes de qualquer código da entrega:

1. O Eduardo cria o app no LinkedIn, associado à página da agência, com os dois produtos ("Share on LinkedIn" e "Sign In with LinkedIn using OpenID Connect"), por um passo a passo do DEV. O Client ID e o segredo vão direto para as variáveis da Vercel; o DEV nunca os vê.
2. No próprio site do LinkedIn (a ferramenta de token do portal de desenvolvedores), o Eduardo gera um token de teste para o LinkedIn dele, com `openid profile w_member_social`. O token fica num arquivo na máquina, lido só pelo processo da sonda, nunca impresso, e apagado no fim.
3. A sonda, só com esse token:
   - lê o `sub` em `GET /v2/userinfo`;
   - pede ao LinkedIn só a **reserva de envio** (`initializeUpload`) de um documento, de um vídeo e de uma imagem, com `owner: urn:li:person:{sub}` e `Linkedin-Version: 202610`;
   - **não envia arquivo, não cria post, nada aparece no perfil.**
   O script passa pela auditoria antes de rodar, e o resultado vai à auditoria e ao Eduardo.

**A leitura, escrita antes de rodar:**
- as três reservas respondem: a entrega segue como desenhada. **A reserva não prova o post.** Que o `POST /rest/posts` com documento e autor pessoa é aceito, só a prova no preview mostra, no primeiro post de carrossel. Se lá der 403, o carrossel do LinkedIn fica desligado na tela, com o motivo, e volta à caixa do Eduardo com as três opções abaixo; as outras formas seguem;
- o documento dá 403 e o resto responde: o carrossel volta à caixa do Eduardo antes do plano. As opções a levar são três:
  - o carrossel vai como várias imagens, se a reserva de imagem responder e as várias imagens também forem aceitas;
  - o carrossel fica só no Instagram;
  - pedir a Community Management API, num app novo e com análise;
- tudo dá 403: a entrega para, e a decisão volta ao Eduardo.

---

## O que muda

### 0. A preparação na `main`, antes de tudo (um PR pequeno, só dela)

Na prova, o preview usa o banco de produção. O dreno da produção, com o código de hoje, roda a cada webhook, a cada tique e no cron, e pegaria uma linha `publicacao_linkedin` antes do preview: ela cairia no caminho das mensagens (`lib/queue-drain.ts:1168`) e se perderia. E a 025 (a do tipo da fila, na parte 2; emenda de 09/11) aplicada à mão quebraria o build de todo deploy da `main` até o merge (188). Por isso, antes dela, um PR pequeno vai à `main`, com o processo de sempre (testes antes, auditoria, OK do Eduardo, merge dele):

- **O dreno só pega os tipos que conhece.** A seleção (`lib/queue-drain.ts:1036-1061`) ganha `kind = any(<os tipos que este código sabe drenar>)`. Um tipo novo, escrito por um código mais novo, fica `pending`, intocado, até o código que o conhece chegar. A lista mora num lugar só, e um teste prende que ela tem todos os tipos do `queue_kind_check`, menos os que um código futuro acrescentar.
- **A conferência aceita as duas formas do `queue_kind_check`:** a da 010 (de hoje) e a da 025, com o `publicacao_linkedin`. Qualquer outro texto continua sendo divergência. Assim, com a 025 aplicada à mão, o build da `main` segue passando, e não há janela.

Com a preparação em produção, a 025 pode ser aplicada antes do preview da parte 2, e a prova não corre o risco de o dreno antigo estragar uma linha do LinkedIn. O dreno do preview drena também as linhas da produção, como em toda prova anterior com o banco de produção. O código do Instagram nele é o mesmo da `main`.

### 1. A migração 024

- **A tabela `linkedin_conexoes`**, uma linha por conta do painel:
  - `account_id text primary key`, com chave estrangeira para `accounts (ig_user_id)` e `on delete cascade`: se a conta sai do painel, o LinkedIn dela sai junto;
  - `pessoa_id text not null`: o `sub` do OpenID Connect;
  - `nome text not null`: o nome que a pessoa tem no LinkedIn, para a tela;
  - `access_token text not null`: em texto puro, como o do Instagram, protegido do mesmo jeito;
  - `expira_em timestamptz not null`;
  - `conectado_em timestamptz not null default now()`.
  Ela nasce com o RLS ligado e sem permissão para `anon` e `authenticated`, pelos privilégios padrão da 020, como a 021, a 022 e a 023.
- **O convite ganha a rede e a conta-alvo**:
  - a coluna `rede text not null default 'instagram'`, com o check `rede in ('instagram', 'linkedin')`;
  - a coluna `conta_alvo text`, com chave estrangeira para `accounts (ig_user_id)` e `on delete cascade`;
  - o check `(rede = 'linkedin') = (conta_alvo is not null)`.
  As linhas de hoje ficam `instagram` e sem conta-alvo, e passam no check.
- **A fila ganha o tipo `publicacao_linkedin`** (NA 025, na parte 2; emenda de 09/11), alargando o check do `kind`, como a 008 e a 010. Alargar é seguro num deploy só: o código antigo nunca escreve o tipo novo, e, depois da preparação (§0), também não o pega. O texto novo do `queue_kind_check` entra no `scripts/migrar.mjs` (`ESPERADAS_RESTRICOES`, `:814`) com `de: "025-..."`, no lugar da linha da 010, e a forma da 010 sai da lista de aceitas no merge da parte 2.
- **A partida.** A `linkedin_conexoes` entra na conferência do esquema como tabela de FEATURE, como a 021 (`lib/esquema.ts:293`): sem ela, o painel sobe, e só o LinkedIn não funciona.
- A 024 é aplicada à mão na produção antes do preview da parte 1, com o OK do Eduardo, como a 022 e a 023. O código da `main` não lê nada dela. A 025, do mesmo jeito, antes do preview da parte 2.

### 2. A conexão e a regra de acesso

- **O repositório** (`lib/linkedin-conexoes.ts`, novo) é o único arquivo que lê a `linkedin_conexoes`:
  - `conexaoDaConta(accountId)`: a linha inteira, com o token, só para o dreno;
  - `resumoDaConexao(accountId)`: só o nome e o vencimento, para as telas;
  - `gravarConexao(...)`, dentro da transação do convite;
  - `apagarConexao(accountId)`, para o desconectar.
- **O token nunca vai ao navegador.** As telas e os componentes de cliente recebem só o `resumoDaConexao`. Um teste de guarda, no molde do achado 60, prende isso.
- **A regra de acesso é a de `lib/acesso.ts`.** O LinkedIn pertence à conta do painel, então quem vê a conta vê o LinkedIn dela e pode publicar nele, e quem não vê a conta não vê nada. Toda action nova confere a conta pelo `podeVerConta`, e o administrador continua sendo quem gera convite e desconecta.

### 3. O convite do LinkedIn

- **Gerar.** Na Configuração, cada conta ganha "Convidar a conectar o LinkedIn". A action nova `gerarConviteDoLinkedin(contaId)` exige o administrador e confere que a conta existe. O convite nasce com `rede = 'linkedin'` e `conta_alvo = contaId`, com o "para quem" igual ao @ da conta, e o link aparece uma vez só, como hoje.
- **A página do cliente** (`/convite/[codigo]`) mostra os passos do LinkedIn quando a rede é `linkedin`: "Conectar seu LinkedIn", entrar com o login dele e autorizar.
- **O começo** (`/api/oauth/convite/[codigo]`) passa a ler a rede:
  - Instagram: segue igual;
  - LinkedIn: monta a autorização em `https://www.linkedin.com/oauth/v2/authorization`, com `response_type=code`, o `client_id` da Vercel, o `redirect_uri` da volta nova, o `state` e o escopo fixo `openid profile w_member_social`. Os cookies são os mesmos de hoje: `state` e convite, `httpOnly`, `lax`, `path=/api/oauth` e 10 minutos. Todo convite usa o mesmo escopo, para um escopo diferente não invalidar o token de antes.
- **A volta é uma rota nova**, `/api/oauth/linkedin/callback`, com a ordem do convite de hoje:
  1. confere o `state` antes de qualquer escrita;
  2. trata a recusa do LinkedIn;
  3. confere que o convite segue pendente e que a conta-alvo existe;
  4. troca o código pelo token (`POST https://www.linkedin.com/oauth/v2/accessToken`) e lê o `sub` e o nome em `GET https://api.linkedin.com/v2/userinfo`, fora de transação;
  5. numa transação, reivindica o convite (`usado_em`, `conta_conectada = conta_alvo`) e grava a conexão. Uma reconexão com outro `sub` troca a pessoa, e o aviso na Configuração mostra o nome novo;
  6. apaga os dois cookies em toda saída e termina em `/convite/pronto`.
  Os segredos saem do texto de erro antes de ir ao banco, como o `textoParaOPainel` de hoje.
- **O endereço da volta:**
  - em produção, é o canônico, `${canonicalAppUrl}/api/oauth/linkedin/callback`, cadastrado no app do LinkedIn;
  - num preview, é o endereço do próprio preview, para o cookie do `state` voltar junto (achado 136). Esse endereço o Eduardo cadastra no app só para a prova.
  O desenho exato (o que decide entre os dois) fica para o plano, medido.
- **Renovar** é gerar um convite novo. Se o cliente estiver logado no LinkedIn, abrir o link já basta, sem tela de autorização.

### 4. O cliente do LinkedIn (`lib/linkedin.ts`, novo)

- A **base** é `https://api.linkedin.com`. Nos testes, ela se move sob as mesmas duas travas da `baseDoGraph` (`lib/ig.ts:63`): a variável `LINKEDIN_API_BASE`, só com `VITEST=true` e só para o loopback.
- A **versão** é uma constante num lugar só, `LINKEDIN_VERSION = "202610"`, com o fim do suporte (15/10/2027) escrito ao lado. **Escolha:** um teste puro falha a partir de 01/09/2027, e com ele **todo `npm test` fica vermelho** até a versão ser trocada. É de propósito: a troca é lembrada seis semanas antes de a versão sair do ar, e não por um post que falha em produção.
- **As chamadas**, todas com teto de tempo, como o `graphFetch`:
  - a troca do código;
  - o `userinfo`;
  - a reserva e o envio de imagem, documento e vídeo (o vídeo em partes, com o `finalizeUpload`);
  - o `POST /rest/posts`.
  O id do post volta no cabeçalho `x-restli-id`.
- **O erro** sai como `LinkedinError(status, texto sem segredo)`.

### 5. As decisões puras (`lib/linkedin-publicacao.ts`, novo, sem import de servidor)

- **As formas.** O painel vira LinkedIn assim:
  - `imagem` vira imagem;
  - `carrossel` vira documento PDF;
  - `reels` vira vídeo;
  - `texto`, a forma nova, vira só texto;
  - `story` não vai ao LinkedIn.
  Uma função diz se a forma e o arquivo servem ao LinkedIn, para a tela e para o servidor:
  - vídeo só MP4, de 75 KB a 500 MB e de 3 s a 30 min;
  - imagem JPG ou PNG;
  - o carrossel de 2 a 10 slides em JPEG.
- **O texto:**
  - o texto do LinkedIn é o campo próprio, se veio, ou a legenda;
  - o limite é 3.000 caracteres, contados antes da barra invertida. Se a barra conta no limite, o plano mede;
  - a barra invertida vai antes dos caracteres reservados;
  - a forma `texto` exige texto.
- **Os erros:**
  - 401: "o LinkedIn de <nome> venceu; mande o convite de novo", permanente;
  - 403: permanente, com o texto do LinkedIn sem segredo;
  - 429 e 5xx: passageiros;
  - os outros 4xx: permanentes.
- **O vencimento.** "Vence em N dias", o aviso a partir de 7 dias e o vencido saem de uma função só, usada pela Configuração, pela tela de publicar e pelo dreno.

### 6. A fila (o cuidado do motor)

Esta parte mexe na fila e no dreno, que são do motor. Ela vai com a auditoria, o DEV e os agentes, e o plano prende cada ponto com teste e mutação.

- **Enfileirar.** A função nova `enqueuePublicacaoNoLinkedin(contaId, payload, quando)` mora em `lib/linkedin-fila.ts`, e não no `lib/engine.ts`:
  - grava `kind = 'publicacao_linkedin'`, com o mesmo `not_before` e o mesmo tique do QStash da publicação de hoje;
  - a chave é `pub-linkedin:<conta>:<forma>:<caminhos>`, com um prefixo próprio, para nunca colidir com a do Instagram. Na forma `texto`, que não tem caminho, a chave leva o hash do texto e do horário;
  - o payload leva a forma do LinkedIn, os caminhos, o texto, o título do documento e, ao longo do envio, as marcas de cada passo.
- **Uma linha por rede.** A action de publicar e o `publicarNaFila` do gerador enfileiram uma linha para cada rede marcada. O Instagram continua passando pelo `enqueuePublicacao` de hoje, sem mudança. Se a linha do LinkedIn não puder nascer (sem conexão, vencida, ou forma que não serve), a tela recusa antes de gravar qualquer linha, com o motivo. Cada linha tem andamento, tentativas e chave próprios: **se uma rede falhar, a outra segue.**
- **A mídia de cada rede.** Quando as duas redes levam arquivo, a linha do LinkedIn recebe uma **cópia** própria no bucket, feita no servidor, de modo que o dreno do Instagram, que apaga depois do `sent`, não apaga o arquivo do LinkedIn. Se a cópia pode ser feita sem baixar o arquivo, o plano mede. Só LinkedIn: sem cópia, e a linha do LinkedIn usa os caminhos originais.
- **A ordem, quando uma parte falha no meio** (192):
  1. todas as conferências (a conta, a conexão, as formas, o texto), sem gravar nada;
  2. a cópia da mídia do LinkedIn. Se ela falha, nada é gravado, e a tela diz o motivo;
  3. a linha do LinkedIn;
  4. a linha do Instagram, pelo `enqueuePublicacao` de hoje. Se ela falha, a do LinkedIn passa a `skipped`, com o motivo, e as cópias saem; a tela diz que nada foi agendado.

  Cada chave contra duplicação vale por si: um post repetido numa rede e novo na outra agenda só a nova, e a tela diz qual já existia. O plano prende cada uma dessas saídas com um caso.
- **Todos os pontos que dizem `kind = 'publicacao'` hoje** (medidos no `56cd72a`), e o que cada um passa a fazer:
  - `lib/queue-drain.ts:992`, a cota de DM: o post do LinkedIn também fica fora dela;
  - `lib/queue-drain.ts:1050`, a exceção da seleção: o post do LinkedIn também não é bloqueado pelo teto de DM;
  - `lib/queue-drain.ts:1349`, o `armarTiquesDoDia`: arma o tique também para o post do LinkedIn;
  - `lib/bonus/publicar-repositorio.ts:109`, o `caminhosNaFila`: procura os caminhos nas linhas dos dois tipos. Ele é usado em `lib/bonus/apagar-carrossel.ts:72` e em `lib/bonus/publicar-processo.ts:243` e `:326`; sem isso, apagar um carrossel que está na fila só do LinkedIn apagaria os arquivos dele;
  - `lib/envio-filters.ts:61`, a lista `KINDS_FORA_DA_ENTREGA_DO_MOTOR`, e `app/page.tsx:155` e `:159`: o post do LinkedIn não conta como mensagem entregue, e a falha dele não conta como falha de mensagem, no Início e no Desempenho;
  - `app/publicar/page.tsx:264`, `:274` e `:297`, e `app/publicar/post/[id]/page.tsx:90`: as telas leem os dois tipos;
  - `app/publicar/post/actions.ts:84` e `:107`: cancelar e remarcar valem para os dois tipos;
  - `lib/db.ts:361` (o tipo do `kind`) e `app/labels.ts:294` (o rótulo "Publicação no LinkedIn").
  O plano refaz essa busca no commit dele e lista o que tiver mudado.
- **O dreno** ganha um ramo `publicacao_linkedin`, ao lado do ramo de hoje (`lib/queue-drain.ts:1160`), que chama `publicarNoLinkedinDaFila` (em `lib/linkedin-fila.ts`). Os outros pontos do dreno que dizem `kind = 'publicacao'` estão na lista completa, acima. O ramo do Instagram e o `publicarDaFila` não mudam.
- **Os passos, cada um marcado no payload antes do seguinte, para a passada repetida não refazer o que já foi feito:**
  1. Lê a conexão. Ausente ou vencida: `failed`, com o motivo.
  2. Prepara a mídia:
     - imagem: reserva, envia e marca o `imagem_urn`;
     - carrossel: monta o PDF com os JPEG dos slides (um por página, no tamanho do slide), reserva, envia e marca o `documento_urn`;
     - vídeo: reserva com o tamanho, envia as partes que o LinkedIn pedir, marca cada `etag` e fecha com o `finalizeUpload`.
     O envio lê do bucket por faixa de bytes (`Range`) e manda parte por parte, sem o arquivo inteiro na memória. Se o tempo da passada acabar, as partes feitas ficam marcadas, e a linha volta a `pending` para continuar de onde parou. Com o teto medido em 03/09 (50 MB), um vídeo tem até 13 partes de 4 MB; o envio em partes vale para qualquer teto.
  3. Publica: `POST /rest/posts` com o autor `urn:li:person:<pessoa_id>`, o texto, `visibility: PUBLIC` (fixo nesta entrega; não há escolha de visibilidade na tela), `distribution.feedDistribution: MAIN_FEED`, `lifecycleState: PUBLISHED` e a mídia. Marca o `post_urn`. Um `post_urn` já marcado nunca publica de novo.
     O documento e o vídeo processam do lado do LinkedIn. Se o post for recusado por mídia ainda não pronta, a linha volta a `pending` com espera, como a espera do contêiner de hoje (+60 s, até 5 consultas).
  4. `sent` e, depois, apaga a mídia da própria linha.
- **As novas tentativas** seguem as de hoje: o permanente vai a `failed`; o passageiro volta a `pending` com +120 s, até 3 tentativas. O texto do erro nunca leva o token.
- **O PDF** é montado pelo pacote `pdf-lib` (JavaScript puro). É dependência nova, e o `package` estava na guarda das entregas anteriores; o plano mede o tamanho, a versão fixa e a licença, e a auditoria a lê antes de entrar. O PDF nasce no dreno, a partir das cópias da linha, e não fica guardado.

### 7. As telas

- **A tela de publicar** (`/publicar/novo`):
  - as caixinhas **Instagram** e **LinkedIn**. A do LinkedIn só fica ligada se a conta tiver conexão dentro da validade; senão aparece desligada, com o motivo ("sem LinkedIn conectado", "o LinkedIn de <nome> venceu");
  - a forma nova **"Só texto"**, que desliga o Instagram;
  - o **story** desliga o LinkedIn;
  - o campo opcional **"Texto para o LinkedIn"**, com o contador de 3.000.
  O enviador manda as redes marcadas e o texto, e a action confere tudo de novo no servidor.
- **O carrossel do gerador:** a mesma caixinha do LinkedIn no cartão de publicar. O andamento de cada rede aparece separado.
- **O calendário e a página do post:**
  - as consultas passam a ler os dois tipos;
  - cada post mostra a rede;
  - a página do post mostra o andamento daquela rede e, publicado, o link "Ver no LinkedIn" (`https://www.linkedin.com/feed/update/<post_urn>/`);
  - cancelar e remarcar valem para os dois tipos.
- **A Configuração** (só administrador): em cada conta, "LinkedIn conectado como <nome>, vence em N dias" (com o aviso a partir de 7 dias), ou "sem LinkedIn", com o botão do convite e o "Desconectar".
- **A política de privacidade e a exclusão de dados** (193). O app do LinkedIn pede o endereço de uma política, e as páginas de hoje falam só do Instagram e da Meta (`app/privacidade/page.tsx:22`). As duas páginas (`/privacidade` e `/exclusao-de-dados`) passam a dizer:
  - o que o painel guarda do LinkedIn: o identificador, o nome e a autorização;
  - para que serve: só publicar o que a agência agenda;
  - como apagar: o "Desconectar" na Configuração, ou o pedido de exclusão. O painel apaga a autorização e para de usá-la; no LinkedIn, ela vence sozinha em até 60 dias (achado 206, emenda de 09/11).

### 8. As chaves

- `LINKEDIN_CLIENT_ID` e `LINKEDIN_CLIENT_SECRET` ficam **só nas variáveis da Vercel** (produção e preview), nunca no código nem no banco, porque o repositório é público. O Eduardo as cadastra.
- Sem as duas, o LinkedIn aparece desligado no painel, com o motivo, e nada mais muda.

---

## As regras, em resumo

| | Instagram | LinkedIn |
|---|---|---|
| Conectar | botão do administrador ou convite | só convite (o perfil é do cliente) |
| Validade | renovada pelo cron | 60 dias; aviso a 7 dias; renovar = convite novo |
| Formas | imagem, carrossel, reels, story | imagem, carrossel (PDF), vídeo, só texto |
| Na fila | `publicacao` (sem mudança) | `publicacao_linkedin` (novo) |
| Falha | não derruba o LinkedIn | não derruba o Instagram |
| Quem vê | `lib/acesso.ts` | a mesma regra, pela conta do painel |

---

## O que fica de fora, e por quê

- **A página de empresa do LinkedIn.** Ela exige a Community Management API, com análise, só num app novo e sem outros produtos. Fica para a entrega seguinte, e o pedido pode ser feito em paralelo.
- **As várias imagens em grade, a enquete e o artigo.** O Eduardo escolheu os quatro formatos acima.
- **Os comentários e os números do LinkedIn no painel.**
- **A renovação automática.** O LinkedIn só dá refresh token a parceiros aprovados.
- **Mais de um LinkedIn por conta do painel.**
- **As outras redes.** Cada uma terá spec, plano e prova próprios.
- **O README** continua sem o LinkedIn. A instalação do zero é outro trabalho, como o da `ADMIN_PASSWORD`.

---

## Os testes, escritos antes do código

- **Puros (`tests/`):**
  - as formas e o que serve a cada rede;
  - o texto: o campo próprio ou a legenda, os 3.000 caracteres e a barra invertida;
  - a classificação dos erros;
  - o vencimento e o aviso de 7 dias;
  - a chave da fila: prefixo próprio, nunca igual à do Instagram, e o caso da forma `texto`;
  - a versão, com a data de troca;
  - a guarda: nenhum componente de cliente importa `lib/linkedin-conexoes.ts`, nem lê o token.
- **De tela (`testes-dom/`):**
  - as caixinhas ligadas e desligadas, com os motivos;
  - o "Só texto" desliga o Instagram, e o story desliga o LinkedIn;
  - o contador do texto do LinkedIn.
- **Da preparação (§0, no PR dela):**
  - o dreno não pega um tipo que não conhece: uma linha de tipo novo fica `pending`, intocada, e as de hoje saem como sempre;
  - a conferência aceita a forma da 010 e a da 025 do `queue_kind_check`, e acusa qualquer outra;
  - mutações: tirar o filtro de tipos, e aceitar qualquer texto na conferência.
- **De integração (`testes-integracao/`, contra o banco de teste e um LinkedIn falso no loopback):**
  - a 024 (parte 1) e a 025 (parte 2): colunas, checks, chaves estrangeiras, cascade, RLS e privilégios;
  - os pontos do `kind = 'publicacao'`: o tique do dia, o `caminhosNaFila`, as contagens do Início e do Desempenho, as telas, e o cancelar e o remarcar, cada um com uma linha do LinkedIn;
  - a ordem do enfileirar: a cópia que falha, a linha do Instagram que falha, e a duplicada numa rede só;
  - o convite do LinkedIn, ponta a ponta: o `state` errado não grava nada; convite vencido, cancelado ou usado; conta-alvo apagada; reconexão;
  - a regra de acesso: o login comum sem a conta não gera convite, não publica e não vê a conexão;
  - a publicação: as duas redes viram duas linhas; uma falha não mexe na outra; a cópia da mídia; a passada repetida não refaz o envio nem republica com `post_urn` marcado; o vídeo em partes retoma de onde parou; o 401 vira "venceu"; o post do LinkedIn não come a cota de DM;
  - o dreno do Instagram dá o mesmo resultado de hoje (a regressão).
- **Mutações:** uma por trava (o `state`, a regra de acesso, o prefixo da chave, a marca do `post_urn`, a cópia da mídia, a cota de DM, o token fora do cliente), cada uma morta pelo caso nomeado.

---

## A prova

- Primeiro, a sonda (acima), sem publicar nada.
- Depois, no preview, com o Eduardo e o roteiro do navegador lido pela auditoria antes (a espera numa página só de texto; achados 176 e 186):
  - a preparação (§0) já em produção, e a migração de cada parte (a 024 na parte 1, a 025 na parte 2) aplicada à mão antes do preview dela, com o OK dele;
  - a conexão por convite;
  - um post de cada forma, com a rede marcada;
  - um post nas duas redes;
  - o vencimento simulado;
  - o desconectar.
- **Em qual LinkedIn os posts de teste saem**, o Eduardo decide pela caixa antes da prova. Como a visibilidade é fixa (`PUBLIC`), cada post de teste é **público** no perfil escolhido, por pouco tempo, e é apagado à mão logo depois de conferido (190).
- Nenhum post no Instagram de cliente, nenhuma DM.
