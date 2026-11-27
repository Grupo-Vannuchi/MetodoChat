# Baixar pelo link: as fotos, os vídeos e os carrosséis de um post da conta escolhida

**Nascido em:** 27/11/2026, sobre a `main` em `85a4bb0`, como o item 2 da ordem de trabalho de 25/11 ("baixar vídeos e
carrosséis por link").
**Desenho:** aprovado pelo Victor em 24/11 e reconfirmado em 27/11 pela caixa ("Continua valendo"). O texto inteiro do
desenho está numa mensagem da auditoria ao DEV, numa conversa da equipe, e não no repositório. Por isso esta spec repete
o que importa dele.
**Decisões de 27/11, pelas caixas:**
- "Seguir, com um aviso" e "Vale, pelos carrosséis e fotos": quando o Instagram não entrega o vídeo, a tela mostra a
  capa e um aviso;
- medir também uma conta de verdade da casa antes da spec;
- "Sim, com 'Copiar legenda'": um acréscimo ao desenho de 24/11.

---

## O que o recurso faz

Em Publicações, um botão novo, **"Baixar pelo link"**, leva a uma página própria. Nela, a pessoa:
1. cola o link de um post da conta escolhida no menu (feed ou reels);
2. vê o post: a capa de cada foto ou vídeo e a legenda;
3. baixa um item de cada vez ("Baixar") ou, num carrossel, todos de uma vez ("Baixar todos"), sem ZIP;
4. copia a legenda com um clique ("Copiar legenda"), quando o post tem legenda.

Quando o Instagram não entrega o arquivo de um vídeo, a tela mostra a capa e o aviso: "O Instagram não entrega este
vídeo (isso costuma acontecer com reels que usam música da biblioteca)." Esse item fica sem botão de baixar.

**Fica de fora:**
- posts de outras contas: só a conta escolhida no menu, entre as que o login vê (`lib/acesso.ts`);
- stories e destaques;
- ZIP;
- TikTok e YouTube, que são o próximo item da ordem;
- qualquer gravação no banco;
- os posts mais antigos que os 1.000 mais recentes da conta: eles não são achados (o teto da procura, mais abaixo).

## O que foi medido (a sonda de 27/11)

A sonda foi uma rota de leitura (`app/api/sonda-baixar/route.ts`), num ramo que nunca foi mesclado (`sonda-baixar`,
`b4f8f1e`), lida na prévia em duas contas. Ela devolvia só a estrutura dos posts: os tipos, os sim/não de cada campo e
as contagens, sem token, sem endereço de mídia e sem legenda. Depois da leitura, a rota, a cópia, o ramo (aqui e no
GitHub) e o deployment da prévia foram apagados.

| | a conta de provas | uma conta de verdade da casa (os 500 posts mais recentes; ela tem mais) |
|---|---|---|
| posts | 105: 16 fotos, 77 reels e 12 carrosséis | 500: 12 fotos, 350 reels e 138 carrosséis |
| reels sem `media_url` (só com a capa) | 1 de 77 | 29 de 350 (8,3%), espalhados por igual entre os recentes e os antigos |
| filhos de carrossel | 71, todos foto, todos com `media_url` | 1090 (1010 fotos e 80 vídeos), todos com `media_url`; de 2 a 20 por carrossel |
| legenda (`caption`) | 105 de 105 | 494 de 500 (seis reels sem legenda) |
| `shortcode` | em todos, e bate com o permalink | em todos, e bate com o permalink |
| permalink | `www.instagram.com/(p\|reel)/CODIGO/`, sem query | o mesmo |
| `media_audio_type` | aceito, mas vazio em todos | aceito, mas vazio em todos |
| páginas de 100 | 2 (cerca de 1,1 s) | 5 cheias, de 1,1 a 1,5 s cada |

**O CDN** (`*.cdninstagram.com` nas 7 amostras), nas quatro formas medidas (foto solta, vídeo solto, foto e vídeo de
carrossel), deu:
- `Access-Control-Allow-Origin: *` e `Cross-Origin-Resource-Policy: cross-origin`;
- nenhum `Content-Disposition` e `Vary` vazio;
- o vídeo solto da amostra tinha 14,8 MB.

Isso foi medido **do servidor**, com o cabeçalho `Origin`, e não do navegador.

**O que se conclui:**
1. Nas 605 mídias medidas, o `shortcode` existe e bate com o código do permalink. Isso sustenta o caminho "colar o link
   → tirar o código → achar o post na lista da conta", mas a procura em si (colar, paginar e achar) não foi exercitada.
   Ela fica para a prova.
2. O `media_audio_type` não serve para prever a falta do vídeo. O único sinal é a falta do `media_url` com a
   `thumbnail_url` presente. A causa (a regra de música da Meta de 30/07/2026) é provável, mas não está provada. Por
   isso o aviso diz "costuma acontecer", e não "acontece por causa da música".
3. Na conta de verdade, cerca de 1 reel em cada 12 vem sem o vídeo. O "quase todos" da caixa de 27/11 não se
   confirmou nos 500 posts mais recentes.
4. A legenda vem pelo login do Instagram, o que fecha o achado 384. A documentação da Meta está imprecisa nesse ponto.
5. O CDN libera a leitura pelo navegador. Isso permite o caminho A2, descrito abaixo.

## Como o arquivo chega ao computador ou ao celular

O atributo `download` num link para o CDN não baixa nada: o navegador só o respeita no mesmo domínio (MDN), e o CDN não
manda `Content-Disposition`. Havia três caminhos:

| | Como funciona | A favor | Contra |
|---|---|---|---|
| **A2** | o navegador busca o arquivo no CDN (`fetch`), monta um `Blob` e salva por um link `download` no próprio endereço do blob | não passa pela Vercel: sem custo de tráfego e sem o teto de tempo da função; o CDN deu `*` | o arquivo inteiro fica na memória antes de salvar; depende do CORS do CDN, que a Meta pode mudar |
| **D** | a nossa rota busca no CDN e repassa em streaming, com `Content-Disposition` | o navegador baixa do jeito nativo, com a barra de progresso | todo arquivo passa pela função: tráfego da Vercel e os 300 s do Hobby |
| **B** | copiar para o Storage e servir um endereço assinado | o endereço dura | grava arquivo e cobra armazenamento, e o desenho diz "nada gravado" |

**A escolha é o A2**, com uma saída para o caso de falha: se o `fetch` falhar (rede, CORS ou um endereço vencido), a
tela troca o botão por um link "Abrir o arquivo numa aba", para a pessoa salvar pelo próprio navegador. É um clique da
pessoa, e não um `window.open` depois de um `await`, que o bloqueador de janelas barraria. O link leva
`target="_blank" rel="noreferrer noopener"`: o CDN foi medido com `Origin`, mas não com `Referer`, e o `noreferrer` tira
essa dependência.

No A2, o download sai depois de duas esperas, a da action e a do `fetch`, e o link do blob recebe o `.click()` sem um
gesto recente da pessoa. Se o Chrome do Android aceita isso sem perguntar não foi medido, e entra na prova.

**O endereço é pedido na hora do clique.** A página não guarda o `media_url`. Cada "Baixar" ou "Baixar todos" chama uma
action que relê o post (`/{id}` com os campos de baixar) com o token da conta escolhida e devolve os endereços novos.
Quanto tempo o endereço do CDN dura não foi medido, e pedir na hora tira esse risco.

## O desenho do código

**`lib/ig.ts`** ganha duas leituras, as duas pelo `graphFetch`, com o teto de 8 s de leitura (`TETO_DA_LEITURA_MS`,
`:128`):
- `paginaDeMidiasParaProcurar(igUserId, token, after?)`: `/{igUserId}/media?fields=id,shortcode,permalink&limit=100`,
  mais o `after` quando houver. Devolve `{ itens, after }`, com o `after` só quando a resposta trouxer `paging.next`.
  Pede só os três campos, para a página ser leve;
- `midiaParaBaixar(mediaId, token)`: `/{mediaId}?fields=id,media_type,media_product_type,media_url,thumbnail_url,caption,permalink,shortcode,children{id,media_type,media_url,thumbnail_url}`.

O `getMedia` e o `getMediaById` de hoje (`:381` e `:390`) não mudam.

**`lib/baixar-pelo-link.ts`** (novo, sem rede e testável inteiro):
- `codigoDoLink(texto)`: devolve `{ ok: true, codigo }` ou `{ ok: false, motivo }`, e é a normalização descrita na seção
  seguinte;
- `postParaBaixar(json)`: transforma a resposta do `midiaParaBaixar` no que a tela usa:
  `{ id, tipo: "foto" | "video" | "carrossel", legenda: string | null, itens: [{ n, tipo: "foto" | "video", url: string | null, capa: string | null }] }`.
  - a legenda vazia ou só com espaços vira `null`;
  - um endereço que não seja https de um host da Meta vira `null`. A regra é a de `urlDeFotoAceita`
    (`lib/bonus/arte-foto.ts:30`): ela confere só o https e o host (`cdninstagram.com` e `fbcdn.net`), sem olhar o
    formato, e por isso serve igual para vídeo, apesar do nome;
  - num vídeo, a `capa` é a `thumbnail_url`, e a `url` é o `media_url` ou `null`;
- `nomeDoArquivo(conta, codigo, n, total, tipoDoBlob, tipoDoItem)`:
  - `conta_CODIGO.mp4` para um item só;
  - `conta_CODIGO_03.jpg` num carrossel, com dois dígitos, para a ordem se manter na pasta;
  - a extensão sai do tipo do blob (`image/jpeg` → jpg, `image/png` → png, `image/webp` → webp, `video/mp4` → mp4) e,
    sem ele, do tipo do item.

**`app/publicar/baixar/`** (novo):
- `page.tsx`: página do servidor, com `dynamic = "force-dynamic"` e `maxDuration = 60`, um literal (a regra de
  `lib/bonus/tempos.ts:7-9`). O guia do Next diz que o `maxDuration` da página vale para as actions usadas nela
  (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md:18`).
  Sem conta escolhida, a página mostra o `textoSemConta` (`lib/logins-textos`), como o `/publicar/novo`;
- `actions.ts`, com as duas actions, cada uma começando por `exigirSessao()` e `getSelectedAccount()`:
  - `procurarPost(link)`:
    1. passa o link pelo `codigoDoLink`;
    2. percorre as páginas da conta escolhida até achar o item cujo `shortcode`, ou o código do `permalink`, seja o
       código procurado, com um **teto de 10 páginas, ou 1.000 posts**, e um **prazo de 40 s**: depois de 40 s
       contados do início da action, ela não começa página nova;
    3. achando, chama o `midiaParaBaixar` e devolve o `postParaBaixar`.
    **A conta do pior caso:** cada leitura pode levar até 8 s antes do `IgTimeoutError`, então 10 páginas sem prazo
    dariam 80 s, acima dos 60 da página, e a action cairia pelo teto da Vercel com um erro genérico, sem a frase da tela.
    Com o prazo, a última página começa antes dos 40 s e acaba até os 48 s, e o `midiaParaBaixar` acaba até os 56 s,
    dentro dos 60. Nos tempos medidos (de 1,1 a 1,5 s por página com os campos todos), as 10 páginas cabem bem antes do
    prazo. O tempo das páginas leves não foi medido;
  - `enderecosDoPost(mediaId)`: aceita só um id de dígitos (`/^\d+$/`), relê o post pelo `midiaParaBaixar` e devolve o
    `postParaBaixar`. A proteção que esta spec garante, e que o teste confere, é que ele só usa o token da conta
    escolhida, que o login vê. Espera-se, sem ter medido, que o token de uma conta não leia o id de um post de outra e
    que esse pedido volte como erro do Instagram;
- `baixador.tsx` (cliente): o campo do link, o botão "Procurar", o post achado, os botões e o aviso. Ele é feito
  primeiro para o celular: uma coluna, alvos de toque com `min-h-11` (como no PR #43) e as capas em grade de duas
  colunas no celular e de quatro no computador.

**`app/publicar/page.tsx`:** o botão "Baixar pelo link" (`btnSecondary`) entra no cabeçalho, ao lado do "Criar post"
(`:335`). O cabeçalho já quebra a linha no celular (`flex-wrap`).

**O menu lateral não ganha item novo.** O recurso fica dentro de Publicações, e a barra lateral, que já não rola numa
janela baixa (o achado 386), não cresce.

## O link colado (hipótese, a conferir na prova)

Os 605 permalinks medidos eram todos `https://www.instagram.com/(p|reel)/CODIGO/`. Os links que a pessoa cola não foram
medidos: os do app do celular costumam vir com `?igsh=…` ou `?utm_source=…`. O `codigoDoLink` aceita:
- com ou sem `https://`, com ou sem `www.` ou `m.`, só no host `instagram.com`;
- os caminhos `/p/CODIGO`, `/reel/CODIGO`, `/reels/CODIGO` e `/tv/CODIGO`, também com um nome de perfil antes
  (`/perfil/p/CODIGO`);
- com ou sem a barra final, com qualquer query ou `#`, e com espaços em volta;
- `CODIGO` só com letras, números, `_` e `-`, de 5 a 64 caracteres.

E recusa, com uma frase para cada caso:
- outro host: "Cole o link de um post do Instagram.";
- `/share/…`: "Este é um link de compartilhamento. Abra-o no navegador e copie o endereço que aparecer (com /p/ ou
  /reel/)." O código do `/share/` não é o do post, e seguir o redirecionamento seria ler o site do Instagram, o que
  este recurso não faz;
- `/stories/…`: "Stories não entram: só posts do feed e reels.";
- um perfil, sem post: "Esse link é de um perfil. Cole o link de um post."

## As mensagens

| Situação | O que a tela diz |
|---|---|
| post achado | o post, com os botões |
| não achado no teto | "Não achei esse post nos 1.000 mais recentes da @conta. Confira se o link é desta conta: o Método Chat só baixa os posts da conta escolhida no menu." |
| o prazo de 40 s acabou antes do teto | "Não terminei de procurar a tempo: olhei os N posts mais recentes da @conta e não achei esse. Tente de novo." |
| erro ou demora do Instagram (`IgError`, `IgTimeoutError`) | "O Instagram não respondeu agora. Tente de novo em instantes." |
| vídeo sem `media_url` | a capa e o aviso da primeira seção, sem botão de baixar |
| a legenda copiada | "Legenda copiada" por alguns segundos; se a cópia falhar, "Não consegui copiar. Selecione o texto da legenda e copie." |
| a falha do download (A2) | o botão vira o link "Abrir o arquivo numa aba" |
| "Baixar todos" em andamento | "Baixando 3 de 20…" |

A legenda aparece na tela, recolhida em três linhas, com "ver tudo". Sem legenda, a caixa e o "Copiar legenda" somem.
O "Copiar legenda" chama o `navigator.clipboard.writeText` direto no clique, com o texto que já está na tela e sem
nenhum `await` antes: o Safari exige que a cópia aconteça na mesma volta do gesto.

## O "Baixar todos"

Ele aparece só num carrossel com mais de um item que tenha arquivo. Uma chamada ao `enderecosDoPost` traz os endereços,
e os itens baixam um depois do outro, com uma pausa curta entre eles. No segundo download, o Chrome costuma perguntar
se o site pode "baixar vários arquivos". Isso não foi medido e entra na prova. Um carrossel tem até 20 itens.

## Os testes

Na suíte de sempre (`npm test`):
- **`codigoDoLink`**, em tabela: cada forma aceita e cada recusa da seção do link, com a frase certa;
- **`postParaBaixar`**:
  - foto;
  - vídeo com e sem `media_url`;
  - carrossel misto, com vídeo no meio;
  - legenda ausente, vazia e só com espaços;
  - um endereço fora da Meta, que vira `null`;
- **`nomeDoArquivo`**: um item, carrossel com dois dígitos, as extensões pelo blob e pelo tipo;
- **as actions**, com o `fetch` simulado:
  - achado na página 1 e na página 3, seguindo o `after`;
  - o teto, que não faz o 11º pedido;
  - o prazo, com o `fetch` simulado lento e o relógio simulado: depois dos 40 s, nenhuma página nova, e a frase do
    prazo;
  - o fim da lista sem `next`;
  - o `IgError` e o `IgTimeoutError`;
  - sem sessão e sem conta;
  - o `mediaId` que não é só dígitos, recusado sem chamar o Instagram;
  - o token usado ser o da conta escolhida, e não o de outra.

Na suíte de tela (`npm run test:dom`), o `baixador`:
- mostra o aviso no vídeo sem arquivo;
- esconde o "Copiar legenda" sem legenda;
- mostra o "Baixar todos" só no carrossel;
- troca o botão pelo link "Abrir o arquivo numa aba" quando o `fetch` falha.

As mutações vão no plano, uma por proteção:
- tirar o teto;
- tirar o prazo;
- tirar a comparação pelo permalink;
- tirar a regra do host;
- mostrar o "Copiar legenda" com legenda `null`;
- aceitar um `mediaId` com letras;
- trocar o `_03` por `_3`;
- tirar a saída do link quando o `fetch` falha.

## A prova na prévia

Na conta de provas, sem gravar nada:
- no Chrome do computador:
  - a procura de verdade: colar o link, achar o post e ver a tela;
  - uma foto, um carrossel, um reel com vídeo e um reel sem vídeo;
  - o "Baixar" de um item salva sem pergunta;
  - cada arquivo salvo abre;
  - o "Baixar todos" de um carrossel, e o aviso de "vários arquivos";
  - o "Copiar legenda";
- o `*` do CDN visto do navegador: o `fetch` do A2 funciona, e o console não mostra erro de CORS;
- os links copiados do app do Instagram no celular, com `?igsh=`, e um `/share/`, que tem de ser recusado com a frase;
- no celular do Victor, que não é iPhone (o sistema dele é perguntado antes da prova): baixar uma foto e um vídeo, ver
  se o "Baixar" salva sem pergunta e conferir onde o arquivo vai parar.

**Lacuna conhecida:** o Safari do iPhone não é provado, porque o Victor não tem iPhone (decisão de 27/11).

## O que não muda

- Nenhuma migração e nenhuma tabela: nada é gravado.
- O `proxy.ts` não muda: `/publicar/baixar` já exige sessão, como todo o resto que não é público.
- O `getMedia` e o `getMediaById` não mudam.

## O PR

- **Branch:** `baixar-pelo-link`.
- **Commits:** a spec; o plano; e os das fases, um por camada (`lib`, actions, tela e o botão em Publicações).
- O `COMECE-AQUI.md:31`, a linha de Publicações na tabela da seção 2, ganha "e baixar as fotos e os vídeos de um post
  da conta pelo link", porque o guia pede que um fato que muda seja atualizado no mesmo PR (`:5`). A data da `:5` e a
  seção 7 ("Onde paramos (19/11/2026)") não mudam aqui. Isso segue o achado 323: uma data nova faria o guia parecer em
  dia.

## Fora desta entrega, na fila

- O achado 386: a barra lateral não rola numa janela baixa (`app/app-shell.tsx:232`, `:331` e `:354`). No celular, é
  uma regressão plausível do #43, ainda não medida.
- A capa do reel sem vídeo para baixar, se o Victor pedir depois.
