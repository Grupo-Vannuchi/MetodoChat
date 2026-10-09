# O gerador de bônus — Etapa 10: a lista de carrosséis e o apagar

**Nascido em:** 09/10/2026, pedido pelo Eduardo com um print da lista "Carrosséis", logo depois de a
Etapa 6 entrar em produção (`main` em `af714d3`). Desenhado com ele pela caixa de perguntas.
**Estado:** desenho aprovado pelo Eduardo, em duas partes (a tela; por dentro); revisado pela auditoria
em `d142ed8`, sem bloqueio, com os achados 92 a 95 absorvidos (o 95 decidido pelo Eduardo).
**Projeto de quem:** do Vinícius Gualberto. Como as etapas anteriores, entra como visita: pasta própria,
e nenhum arquivo do `/publicar`, da fila nem das automações muda.
**Etapas anteriores:** a Etapa 7 criou o menu "Carrosséis" (`app/carrosseis/page.tsx`); a Etapa 5, o
publicar e a trava da publicação (`publicacaoLivre`, `lib/bonus/publicar-estado.ts:63`).

---

## O que é

Hoje a lista "Carrosséis" mostra todos os carrosséis numa coluna só, com um selo "Revisado" que quase
todos têm, e não há como apagar um carrossel que não serve mais. Esta etapa:

1. separa a lista em três abas pelo estado da publicação;
2. mostra a capa (o slide 1) em cada linha;
3. troca o selo pelo que importa: o que falta fazer, quando sai, quando saiu;
4. permite apagar um rascunho, na página dele, com confirmação.

---

## As decisões, e de quem

Do Eduardo, pela caixa, em 09/10:

| assunto | decisão |
|---|---|
| o que ajustar na lista | mostrar se foi publicado, ver a capa em cada linha, e separar |
| como separar | abas pelo estado: "Rascunhos", "Agendados" e "Publicados" |
| o que se apaga | só o rascunho; o agendado se cancela antes, no calendário; o publicado fica como histórico |
| onde fica o "Apagar" | no fim da página do carrossel, com confirmação (a lista fica sem botão perto do clique de abrir) |
| o que falhou ao publicar | fica em "Rascunhos", com o selo vermelho "Não publicou" |
| o desenho | aprovado em duas partes |
| a imagem da Etapa 6 sendo gerada (achado 95, da revisão) | trava o apagar até ela terminar ("Espere a imagem terminar para apagar."), para a imagem já paga não ir fora |

---

## A tela

### A lista "Carrosséis" (`/carrosseis`)

- **As abas**, no topo, cada uma com o número de carrosséis: **"Rascunhos (N)"**, **"Agendados (N)"** e
  **"Publicados (N)"**. A lista abre em "Rascunhos". A aba vai no endereço (`/carrosseis?aba=agendados`),
  para o voltar do navegador e um link levarem à mesma aba; um valor desconhecido abre "Rascunhos".
- **Em que aba cai cada carrossel**, pelo estado da publicação de hoje (`EstadoDaPublicacao`,
  `lib/bonus/publicar-estado.ts:17`):

  | estado | aba |
  |---|---|
  | `agendado`, `publicando` | Agendados |
  | `publicado` | Publicados |
  | `livre`, `cancelado`, `falhou`, `nao_entrou`, `saiu_da_fila`, `desconhecido` | Rascunhos |

- **A ordem dentro de cada aba:** em "Rascunhos", o mais novo primeiro (pela criação, como hoje); em
  "Agendados", o próximo a sair primeiro (pela hora agendada; o "publicando" antes de todos); em
  "Publicados", o mais recente primeiro (pela hora em que saiu).
- **A capa**, à esquerda de cada linha: a miniatura do slide 1, na proporção 4:5, a mesma que a página do
  carrossel mostra (a arte do slide 1, ou a imagem do "Slide pronto do Canva", se o slide 1 for um).
  Carregada só quando aparece na tela. O carrossel ainda gerando, que travou ou que falhou na geração
  mostra um quadro vazio no lugar.
- **O selo**, à direita, diz o que importa em cada aba (o "Revisado" sai):
  - em "Rascunhos", só quando há algo a fazer: o da geração que não está pronta ("Gerando", "Travou",
    "Falhou", "Pronto para revisar", os rótulos de `rotuloDoCarrossel`), e o da publicação que não foi
    ao ar ("Não publicou", vermelho; "Não entrou na fila", "Saiu da fila" e "Estado desconhecido", os
    rótulos de hoje). O cancelado e o nunca agendado ficam sem selo;
  - em "Agendados": **"Agendado para 16/10, 10:00"** (horário de Brasília) ou **"Publicando…"**;
  - em "Publicados": **"Publicado em 09/10, 15:30"** (horário de Brasília). Se a fila não tiver a
    hora em que saiu (o tipo permite: `em: Date | null`, `publicar-estado.ts:21`; na produção, hoje, 0
    casos), o selo diz só **"Publicado"**, e o carrossel vai para o fim da aba (achado 93).
- **A aba vazia** diz "Nenhum rascunho.", "Nenhum carrossel agendado." ou "Nenhum carrossel publicado.".
- O resto da linha não muda: o título, a origem, a conta, o tipo e a data de criação, e o clique leva à
  página do carrossel.

### A página do carrossel (as duas rotas)

- No fim da página, depois do card "Publicar", **"Apagar carrossel"**, só quando o carrossel pode ser
  apagado (abaixo). Ao clicar, o botão dá lugar à pergunta **"Apagar este carrossel e as imagens dele?
  Não tem volta."**, com **"Sim, apagar"** e **"Cancelar"**. Nada é apagado no primeiro clique.
- Quando não pode, no lugar do botão, uma frase (e nada no publicado):
  - agendado ou publicando: "Para apagar, cancele o agendamento no calendário antes.";
  - a geração do texto em andamento: "Espere a geração terminar para apagar.";
  - uma imagem do carrossel sendo gerada (Etapa 6): "Espere a imagem terminar para apagar." (achado 95);
  - o estado da publicação que o Chat não conseguiu conferir (`saiu_da_fila`, `desconhecido`): "Não
    consegui conferir a publicação deste carrossel; ele não pode ser apagado agora.".
- Vale também na página do carrossel que falhou ou travou na geração, que hoje mostra só o erro: ela
  ganha o mesmo "Apagar carrossel" no fim.
- **Depois de apagar**, a página vai para a lista "Carrosséis", na aba "Rascunhos", com o aviso
  **"Carrossel apagado."**, em verde, pelo aviso que a lista já lê do endereço (`avisoDaUrl`). O endereço
  leva o tom: `/carrosseis?aba=rascunhos&aviso=Carrossel%20apagado.&tom=ok`, montado por uma função pura
  com teste (`urlDepoisDeApagar`), porque sem `tom=ok` o aviso sai vermelho (`avisos.ts:269-272`; achado
  92). A recusa do servidor (o carrossel foi agendado em outra aba, por exemplo) aparece como estado no
  próprio botão, nunca por redirect (achado 52).

---

## Por dentro

### Quem pode ser apagado

Uma regra pura (`podeApagar`), a mesma na tela e no servidor:

- a publicação **livre pela regra do publicar** (`publicacaoLivre`, `publicar-estado.ts:63`: nunca
  agendado, cancelado, falhou ou não entrou na fila). A trava do publicar e a do apagar são uma só: o que
  impede publicar de novo impede apagar;
- a geração do texto **fora de andamento** (`geracaoNaTela` diferente de `gerando`): pronta, travada ou
  falhada;
- e **nenhuma imagem do carrossel sendo gerada** (Etapa 6): nenhuma linha de `imagens_geradas` dele no
  estado `gerando` dentro do prazo (`estadoDaImagem` dá `gerando`; a linha que passou de
  `TRAVADA_IMAGEM_MS` é travada e não segura o apagar). Decisão do Eduardo na revisão (achado 95): sem
  isso, o apagar passaria, a imagem já paga à OpenAI (US$ 0,0432) falharia no guardar e contaria no teto.

### O apagar no servidor

Uma action nova (`apagarCarrossel`, em `app/bonus/`, ao lado das actions do carrossel) confere a sessão
antes de tudo, como toda action do gerador, e lê o id. Ela devolve estado em toda recusa (achado 52) e,
no sucesso, vai para a lista com o aviso.

Numa transação (`lib/bonus/apagar-carrossel.ts`, novo, `server-only`):

1. trava a linha do carrossel (`select … for update`, pelo id), o mesmo jeito que o agendar e o salvar
   usam, para o apagar e um agendar ao mesmo tempo não passarem os dois;
2. lê a publicação guardada e a linha da fila dela (`estadoDoCarrossel`) e as linhas de
   `imagens_geradas` dele, pelo relógio do banco, e confere `podeApagar`. Não pode: recusa com a frase, sem
   apagar nada. **A corrida com um pedido de imagem** fica fechada pela chave estrangeira da 018: o
   `insert` da reserva da imagem trava a linha do carrossel em `key share`, que espera o `for update` do
   apagar (e vice-versa). Se a reserva entra antes, o apagar a vê e recusa; se o apagar entra antes, a
   reserva falha pela chave estrangeira, sem chamar a OpenAI;
3. apaga a linha (`delete … returning`, exigindo 1). As linhas de `imagens_geradas` dele ficam, com o
   carrossel nulo, pela chave estrangeira da 018 (`on delete set null`): são o histórico do teto das
   imagens. As linhas da fila ficam, como histórico.

Depois do commit, os arquivos dele saem do bucket, com `apagarSemDerrubar` (`publicar-bucket.ts:70`):

- as imagens guardadas nos slides (`arte.imagens`): as fotos e as imagens geradas em `bonus-foto/`, e os
  slides prontos do Canva em `bonus/`;
- as cópias da fila que tenham sobrado (`arte.publicacao.caminhos`, em `bonus-fila/`); o cancelamento já
  as tira, e a publicação que falhou pode tê-las deixado.

Uma falha no bucket não desfaz o banco: o carrossel já está apagado, e o arquivo fica sem dono (como em
"O que fica no bucket sem dono", da Etapa 5).

**O bônus dono do carrossel** não muda: o carrossel só some da lista do bônus.

**A geração de imagem em andamento** (Etapa 6) segura o apagar (acima). Se, ainda assim, uma geração
terminar num carrossel apagado (a linha travada pelo prazo, por exemplo), ela termina sozinha: o
`guardarImagem` não acha o carrossel (`publicar-repositorio.ts:71-73`), a geração apaga o que subiu e marca
a linha `falhou` (`imagem-processo.ts:71-77`).

### As abas, os selos e a capa

- `lib/bonus/carrosseis-tela.ts` ganha a aba de cada carrossel (`abaDoCarrossel`, pura, pela tabela
  acima), o selo novo, e a ordem dentro da aba. A página lê os carrosséis e os estados da fila como hoje,
  e conta as abas.
- O selo do agendado e do publicado precisa da hora: a do agendado é o `not_before` da fila (o
  `quando` do estado); a do publicado, o `sent_at` (o `em`). Formatados no horário de Brasília.
- **A capa** usa a rota da arte que já existe (`urlDaArte`, `lib/bonus/arte-tela.ts:135`), com a versão
  do slide 1 (`versoesDosSlides`, `:115`), calculada como a página do carrossel calcula. A lista passa a
  ler as contas do cabeçalho uma vez (`contasParaArte`). O slide pronto do Canva usa a imagem dele.
  `loading="lazy"` e o tamanho fixo na linha.

### O que não muda

- O publicar, a fila, o calendário do `/publicar`, as automações e o desenho da arte.
- A página do bônus, menos o carrossel apagado sumir da lista dela.
- Sem migração: nenhuma tabela nem coluna muda. O build do merge diz "Nada a aplicar: as 19 migrações".

---

## O efeito na produção

As abas, a capa e os selos aparecem na hora, para os carrosséis de hoje. O "Apagar carrossel" grava na
produção (apaga a linha e os arquivos), só pelo clique do operador, com a confirmação.

Medido pela auditoria em 09/10, às 18:25Z, só lendo: os 5 carrosséis de hoje (`13879179`, `c9388ad5`,
`e6af940e`, `d3619afc` e `4c5701a8`, todos de bônus, com a geração pronta e a publicação livre) caem em
"Rascunhos"; "Agendados" e "Publicados" ficam vazios. Nenhum tem imagem no slide 1, então as capas de hoje
são a arte do slide 1.

---

## Testes

| suíte | o quê |
|---|---|
| pura | `abaDoCarrossel` em cada um dos nove estados; a ordem dentro de cada aba (o "publicando" antes dos agendados; o publicado sem hora no fim); o selo de cada aba (sem o "Revisado", o "Não publicou" vermelho, "Agendado para…" e "Publicado em…" no horário de Brasília, e "Publicado" sem a hora, achado 93); a contagem das abas; a aba do endereço (desconhecida abre "Rascunhos"); `urlDepoisDeApagar` com `tom=ok` (achado 92) |
| pura | `podeApagar`: os quatro estados livres, a geração parada e as imagens paradas podem; agendado, publicando, publicado, `saiu_da_fila`, `desconhecido`, a geração do texto em andamento e uma imagem gerando dentro do prazo não (a travada pelo prazo não segura); a frase de cada recusa |
| integração | apagar um rascunho: a linha some, as linhas de `imagens_geradas` ficam com o carrossel nulo, as linhas da fila ficam, e os arquivos das imagens e as cópias da fila saem do bucket falso |
| integração | as recusas, sem apagar nada nem tocar no bucket: agendado, publicando, publicado, geração do texto em andamento, uma imagem gerando (achado 95), o carrossel que não existe |
| integração | o apagar e o agendar ao mesmo tempo: um espera o outro; se o agendar passa antes, o apagar recusa |
| integração | o apagar e a reserva de uma imagem ao mesmo tempo: se a reserva passa antes, o apagar recusa; se o apagar passa antes, a reserva falha pela chave estrangeira, sem linha nova |
| integração | a falha do bucket depois do commit não desfaz o banco |
| tela | as três abas com a contagem, a aba do endereço, a capa em cada linha, o selo de cada aba e a aba vazia; o "Apagar carrossel" com a confirmação em dois cliques, o "Cancelar" que volta, a frase no lugar do botão quando não pode, e a recusa do servidor que aparece no botão |
| páginas | a action nova confere a sessão antes de tudo (a guarda que lê o arquivo); a página do carrossel que falhou na geração também tem o botão |

Cada proteção principal ganha uma prova de mutação: retirada de propósito, o teste certo cai.

---

## A prova real

No preview, com o Eduardo na tela. O preview usa o banco e o bucket de produção. **Sem custo e sem post
real.** A auditoria lê o banco antes e depois de cada gravação, com a hora mandada antes.

1. A lista: as três abas com os carrosséis de hoje, a capa em cada linha e os selos novos, conferidos
   contra a medição da auditoria (hoje, os 5 em "Rascunhos").
2. "Novo carrossel" → texto livre → "Escrever à mão", com 1 slide (grava). Ele aparece em "Rascunhos",
   sem selo, com a capa.
3. Agendar esse carrossel para daqui a 7 dias (grava; achado 94): a lista mostra "Agendados (1)", com o
   selo "Agendado para…", e a página dele mostra "Para apagar, cancele o agendamento no calendário
   antes." no lugar do botão.
4. Cancelar no calendário do `/publicar` (grava): ele volta a "Rascunhos", sem selo, e o botão volta.
5. "Apagar carrossel" → "Cancelar" (nada muda) → "Apagar carrossel" → "Sim, apagar" (grava): a lista em
   "Rascunhos", com "Carrossel apagado." em verde, sem ele. A auditoria confere a linha apagada, as linhas
   da fila que ficam e o bucket.

"Publicados" não tem dado real para a prova (nenhum carrossel foi publicado, e a prova não publica):
fica coberto pelos testes, e o PR diz isso.

Os textos sugeridos para digitar passam antes pelo schema de cada campo (o mínimo e o máximo).

---

## Pré-condições

Do merge:

1. `npm run verify` limpo, a integração verde no container, e o preview com a prova feita.
2. O build do merge diz "Nada a aplicar: as 19 migrações".
3. Nenhum `next dev` apontado para a produção durante o deploy, e as abas recarregadas depois.

---

## Fora desta etapa

- Apagar vários de uma vez, ou apagar pela lista.
- Apagar um publicado (o post continua no Instagram; o registro fica no Chat) ou cancelar e apagar num
  passo só.
- Filtrar por conta, separar bônus e avulsos, renomear um carrossel.
- Desfazer o apagar (lixeira).
