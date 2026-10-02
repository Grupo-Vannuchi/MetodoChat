# O gerador de bônus — Etapa 4: a página do carrossel, slide a slide

**Nascido em:** 02/10/2026, desenhado com o Eduardo pela caixa de perguntas, a partir do retorno dele
e do Vinícius no merge da Etapa 3, com a sessão auditora levantando os riscos durante o desenho.
**Estado:** desenho aprovado pelo Eduardo nas três partes (a página; o "não cabe" com o Labs e a
foto; a prova).
**Projeto de quem:** do Vinícius Gualberto. Como as etapas anteriores, entra como visita: pasta
própria e o mínimo de toque no que já existe.
**Etapas anteriores:** `docs/specs/2026-09-29-gerador-de-bonus.md`,
`docs/specs/2026-09-30-gerador-de-carrossel.md` e `docs/specs/2026-10-01-arte-do-carrossel.md`.

---

## O que é

Na Etapa 3, a página do carrossel pronto ficou em dois blocos: a grade das miniaturas em cima e,
embaixo, o editor com todos os textos e um "Salvar revisão" só. Para conferir uma edição, era
preciso rolar a página. Nesta etapa, cada slide vira um card: a miniatura e, ao lado, o editor
daquele slide, com um "Salvar slide N" que grava só ele e troca só a miniatura dele.

Na mesma página, três ajustes:
- o carrossel passa a ser da conta em que nasceu, e o seletor de conta sai;
- o aviso "não cabe" deixa de errar no limite (achado 70), com o mesmo conserto no Labs;
- a foto da conta fica em memória, para as miniaturas não a buscarem uma a uma na Meta.

---

## A ordem das etapas, decidida pelo Eduardo em 02/10

| ordem | o quê |
|---|---|
| **4** | **esta spec**: a página slide a slide, a conta da geração, o "não cabe" e a foto em memória |
| 5 | publicar: o upload dos slides prontos (o "devolver do Canva") e o envio pelo `/publicar` do Vinícius, que já publica carrossel de 2 a 10 imagens JPEG |
| 6 | o criador de imagem, que preenche o espaço reservado |
| 7 | o carrossel avulso: sem bônus, nada ligado ao Labs |

A Etapa 4 vem antes porque o upload e o criador de imagem vão morar no card de cada slide que ela
cria, e porque a imagem gerada vai ocupar o espaço em branco, que o achado 70 mostrou poder descer
para a margem.

---

## As decisões, e de quem

Todas do Eduardo, em 02/10, pela caixa de perguntas.

| decisão | escolha |
|---|---|
| ordem | a página do carrossel primeiro |
| de que conta é o carrossel | da conta logada quando ele nasceu: gerado com o Thiago e aberto com a N8X, continua do Thiago |
| a conta desconectada do Chat | o carrossel continua dela, com o nome e o @ guardados ao nascer e as iniciais no lugar da foto |
| a página | lista: um slide por linha, a miniatura à esquerda e o editor ao lado, expansível |
| salvar | um botão por slide, que grava só aquele slide |
| o "não cabe" | a largura real de cada letra, quebrando por palavra como o desenho; a folga de 48px e a manchete de 77px entram (a "quebra por palavra com a largura de hoje" foi a primeira escolha, revista com as medidas) |
| o gancho longo | um degrau de 46px entre o 56 e o piso de 34 |
| os carrosséis sem conta gravada | um botão "Fixar nesta conta", uma vez só |
| a margem e a foto | a primeira coisa desta etapa (decidido no fechamento da Etapa 3) |

"Conta logada", no Chat, é a conta selecionada no painel (o cookie `metodochat_account`, trocado
pelo seletor da barra lateral), e não um login.

---

## A página

### Um card por slide

A seção "Arte dos slides" deixa de ser uma grade e vira uma lista: um card por slide, na ordem.
Cada card tem:

- a miniatura do slide, à esquerda;
- ao lado, "Editar", que abre e fecha os campos daquele slide, com o contador, o aviso da palavra
  e o "não cabe" enquanto se digita;
- o "Salvar slide N";
- o "Só texto", o "Baixar o slide N" e o "Copiar" de cada campo, que já existem.

Em tela estreita, a miniatura fica em cima e o editor embaixo. Depois do último slide, um card
"Legenda", com o mesmo editar e salvar: a legenda não é slide, mas também se revisa. O "Baixar
todos" fica no fim da lista.

O editor no fim da página e o "Salvar revisão" único deixam de existir.

### Qual campo é o slide N

Uma função só decide quais campos formam cada slide, e ela é usada pela rota da arte, pela versão
da miniatura, pelo "não cabe" e pela action de salvar:

- no carrossel: o slide 1 é o `gancho`; os slides 2 a N−1 são `slide_{N−1}_titulo` e
  `slide_{N−1}_texto`; o último é a `chamada`. Com total 2, são só o gancho e a chamada;
- no post de uma imagem: o slide 1 junta o `texto` e a `chamada`, como a arte já desenha
  (`slidesDoPost`);
- a `legenda` e o título interno nunca são slide.

`campoDoAviso` (lib/bonus/arte-cabimento.ts) já faz parte disso para o aviso; a função nova a
substitui ou a usa, sem duas regras para a mesma coisa. Os testes cobrem os totais 1, 2, 3 e 10.

### Vários formulários na mesma página

Cada card tem o seu formulário, e as lições dos achados 52 e 54 valem para cada um:
- os campos são controlados;
- a resposta volta como estado, nunca por redirect;
- a guarda contra `defaultValue=` cobre os componentes novos;
- o botão de cada card fica desligado enquanto o salvar dele está pendente.

Um card com edição não salva mostra "não salvo", porque sair da página perde o que não foi gravado.

---

## Salvar um slide

Uma action nova, `salvarSlideDoCarrossel`, recebe o id do carrossel, qual parte se salva (o slide N
ou a legenda) e os campos dessa parte.

1. **Começa por `await exigirSessao()`**, como toda action desta pasta. Uma conta mandada no
   formulário é ignorada.
2. **Junta e grava numa transação, com a linha travada** (`select … for update`). O servidor lê o
   texto salvo (`revisado ?? gerado`), troca só os campos da parte e grava. Dois salvamentos ao
   mesmo tempo, de slides diferentes, não apagam um ao outro.
3. **Recusa só pelo que a parte toca.** O texto inteiro é conferido, como hoje, com a palavra na
   chamada e na legenda e nenhuma outra palavra gritada na chamada. Mas a recusa vem só dos problemas
   nos campos da parte salva. Um problema em outro campo vira aviso, e não impede o salvar. Sem
   isso, uma regra que mudasse num deploy deixaria todo "Salvar slide N" recusado por causa de outro
   campo, sem saída. A medição de 02/10 diz que hoje os 5 carrosséis da produção passam inteiros
   pela conferência.
4. **A resposta volta como estado** (`useActionState`), com o resultado e a versão nova da miniatura
   daquele slide. Nunca por redirect (achado 52).

### A versão de cada miniatura

Hoje, a versão na URL das miniaturas é uma só para o carrossel inteiro: qualquer gravação pede as
10 de novo, e isso pareceu lento no preview. A versão passa a ser por slide, calculada a partir do
mesmo `SlideParaArte` e do mesmo `CabecalhoDaArte` que a rota desenha: o texto medido, o tipo, o
número, o total, o "só texto" daquele slide e o cabeçalho (nome, @ e foto). Salvar o slide 1 pede
de novo só a miniatura 1. Um teste prova que cada uma dessas entradas muda a versão, para não
voltar a miniatura velha.

---

## A conta do carrossel

- **O carrossel é da conta gravada no pedido.** A Etapa 3 já grava a conta logada em
  `carrosseis_gerados.arte.conta` ao pedir. A arte, a página e a rota usam essa conta.
- **O carrossel guarda o nome e o @ da conta ao nascer** (`arte.nome` e `arte.arroba`), junto da
  conta, no pedido, no "Gerar de novo" e no "Fixar nesta conta". Com a conta conectada, a arte usa os
  dados atuais dela, com a foto. Desconectada (o Chat apaga a linha da conta), a arte segue com o
  nome e o @ guardados e as iniciais no lugar da foto: o carrossel nunca vira de outra conta. Decisão
  do Eduardo em 02/10.
- **O seletor de conta sai da página.** Trocar a conta logada no Chat não muda os carrosséis que já
  existem.
- **"Gerar de novo" herda a conta, o nome e o @ do carrossel original**, e não usa a logada no
  momento, mesmo com a conta do original desconectada (decisão do Eduardo em 02/10). Só sem conta
  gravada no original ele usa a logada.
- **Carrossel com conta e sem o nome guardado.** Até o deploy desta etapa, o pedido e o seletor da
  Etapa 3 gravam a conta sem o nome. Em 02/10 (14:29Z) eram 2, os de 4 e de 10 slides, que ganharam
  conta pelo seletor. Para fechar essa janela sem DDL e sem gravar numa leitura, toda action que já
  grava num carrossel (salvar um slide, gravar o "só texto") guarda também o nome e o @ quando a conta
  está conectada e o nome falta. Se a conta for desconectada antes de alguma gravação, a arte cai na
  conta logada e a página avisa, como na Etapa 3.
- **Carrossel sem conta gravada** (de antes da `015`, sem dado para descobrir de que conta era; em
  02/10 eram 3, os de 1, 2 e 3 slides): mostra a conta logada, com um aviso e o botão "Fixar nesta
  conta". O botão grava a conta logada, com o nome e o @, uma vez, e o carrossel passa a ser como os
  novos. A action recusa se o carrossel já tiver conta.

A spec descreve esses grupos pela condição (tem conta e não tem nome; não tem conta), e não pela
lista: a lista muda enquanto a Etapa 3 está no ar.
- **Gravar o "só texto" não pode apagar a conta.** Hoje `salvarEscolhasDaArte` troca o objeto
  `arte` inteiro (`set arte = $2::jsonb`). Ela passa a gravar só a chave `soTexto`
  (`arte || jsonb_build_object('soTexto', …)`), e um caso de integração prova que a conta fica,
  com uma prova de mutação.

---

## O "não cabe" (achado 70), com o Labs

Medido em 02/10, com 66 PNGs no limite de cada degrau: nenhum texto cortou na borda, mas a peça
invadia a margem de baixo. A conta trazida do Labs não via três espaços que o desenho gasta, e
media as letras por uma largura média. O Labs conferiu no código de lá (Etapa 48 do ROADMAP deles,
na `dev` em `ab34976`), achou o terceiro espaço (a manchete), e mediu os mesmos casos na arte de lá,
com os mesmos números ao pixel.

### A folga de 48px

Com o espaço da imagem, o desenho põe 48px entre o texto e o espaço (`GAP_ILUSTRACAO`), e a conta
não os desconta: `ALTURA_TEXTO_COM_ILUSTRACAO` dá 382, e o desenho só tem 334. O conserto leva
`GAP_CABECALHO` e `GAP_ILUSTRACAO` para a geometria, de onde o desenho os importa, e desconta o
`GAP_ILUSTRACAO` da altura com ilustração. A geometria passa a conhecer todo número que ocupa
altura; a altura sem ilustração (955) não muda.

Os 48px de baixo, com o cabeçalho no pé, não são uma segunda causa: com a tag no topo ou no pé, o
respiro de 48px entre a tag e o texto já está nos 175 do `CABECALHO_ESTIMADO` (127 + 48). Nos dois
casos sobram 334px com o espaço da imagem.

### A manchete ocupa no mínimo 77px

O desenho dá à manchete `marginBottom: max(0, 77 − round(fonte × 1,32))` (`AVANCO_MANCHETE`), e a
conta a tratava como uma linha comum. A 34px, a conta via 45px e o desenho gastava 77. A conta passa
a dar à manchete de n linhas `n × fonte × 1,32 + max(0, 77 − round(fonte × 1,32))`. Com uma linha, isso
é perto de 77; com duas, `fonte × 1,32 + 77`. O `AVANCO_MANCHETE` vai para a geometria, como os
intervalos.

### A largura real de cada letra, quebrando como o desenho

Em caixa alta e fonte grande, a conta previa uma linha a menos. A causa principal é a quebra: a 116px
cabem uns 13 caracteres por linha, e a palavra que não cabe vai inteira para a linha de baixo. A
conta por caractere não via isso. Mas quebrar por palavra com a largura média de hoje (0,5538 do
corpo, a média das maiúsculas da Carlito Regular) deixava a conta conservadora demais: medida nos
carrosséis da produção, ela encolhia peças que cabiam, como um gancho de 64 caracteres de 72 para
56px, e não via o negrito, que é 2,5% mais largo (achado 71).

A conta passa a medir cada linha com a largura de avanço de cada letra da Carlito, tirada dos `.ttf`:
- Regular ou Bold, como o desenho: a manchete e o bloco final (quando há mais de um bloco, ou não há
  manchete) saem em negrito, e com `letterSpacing` de −0,4px por letra;
- quebra gulosa nos pontos em que o Satori quebra: no espaço, e depois do hífen;
- a palavra mais longa que a linha (um @perfil, uma URL) quebra por letra;
- o espaço tem a largura real dele;
- um caractere sem desenho na fonte (o emoji, que vem da twemoji, ou outro alfabeto) conta 1 em.

Com a tabela do negrito, o achado 71 fica resolvido por desenho. O comentário de `alturaEstimada` que
diz que ela "erra para o lado seguro" é corrigido.

**A tabela não é cópia à mão.** Um script na pasta da feature a gera a partir dos `.ttf` versionados
(google/fonts `3dd7884402`), e um teste a recalcula dos `.ttf` e compara. Uma fonte trocada sem tabela
nova derruba o teste. A tabela serve também ao Labs: ele busca a Carlito na hora pela API do Google
Fonts, e as larguras de lá são iguais às dos `.ttf` do Chat em 190 de 191 caracteres do português
(medido pela auditoria em 02/10; o que sobra não tem desenho em nenhuma das duas). Se a busca do Labs
falhar, ele desenha com a fonte padrão, e aí nenhuma tabela vale; isso é do lado de lá.

**O gancho ganha o degrau de 46px** (decisão do Eduardo). Com 334px, as 5 linhas de 56 não cabem, e
sem o 46 o gancho longo cairia direto para o piso de 34.

### O que foi medido para decidir

Com uma régua descartável no ensaio (o desenho de verdade, com o espaço da imagem pintado para
aparecer no pixel, contra a linha 1240), em 02/10:

| conta | o maior texto aceito em cada degrau: peças além da margem | os 5 carrosséis da produção (40 peças): além da margem |
|---|---|---|
| hoje (382, por caractere) | 44 de 108, até 109px | 8 |
| por palavra, largura de hoje | 1 de 113, 7px | 3, e 15 mudam de tamanho, algumas que cabiam |
| só o espaço na largura real | 19 de 112, até 60px | — |
| largura real de cada letra | 0 de 112 | 3, e só descem as que invadiam; algumas sobem onde sobrava |

As 3 peças da produção que ficam além da margem não cabem nem no piso, e o aviso passa a acusar. Os 4
casos que o Labs desenhou na arte de lá dão os mesmos números no instrumento do Chat. A capa de 109
caracteres, que cabia com folga de 39px, fica em 56px na largura real; na quebra por palavra com a
largura de hoje, descia para 46 sem precisar.

### O efeito na produção

Para o Eduardo saber antes do merge: as peças que não cabem nem no piso passam a mostrar o aviso, e o
operador terá de encurtar ou marcar "só texto". As que mudam de tamanho saem diferentes dos PNGs
baixados antes do deploy.

### Dois donos

A conta veio do Labs, e tem de dar o mesmo resultado nos dois projetos. Proposta do Labs (a sessão
`site-ia-83` em 02/10), decidida pelo Eduardo ("Mesmos casos de teste"):
- cada projeto escreve a conta no próprio código;
- a tabela de larguras sai de um script versionado, a partir dos `.ttf`;
- um teste recalcula a tabela e reprova se ela divergir;
- os dois projetos conferem o MESMO conjunto de vetores (texto, tipo, modo e manchete → degrau e
  altura), com os limites da régua e os casos que o Labs desenhou como base.

Código copiado garante igualdade no dia da cópia; vetores compartilhados garantem o mesmo resultado
nos dias seguintes. O "sem mudar uma linha do Labs em `45bc973`" da Etapa 3 deixa de valer para a
geometria e os slides, e o cabeçalho de cada arquivo passa a citar os vetores. Sem isso, repete-se o
que aconteceu com o aviso do Labs em `1254847`, que divergiu do desenho.

### A régua, como teste

O "pronto quando" é o da Etapa 48 do Labs, e aqui ele vira um teste automático. O teste desenha o
maior texto que a conta aceita em cada degrau, para:
- os três estilos: frase, caixa alta e lista;
- os três tipos: gancho, conteúdo e chamada, mais o post;
- os dois modos: com espaço e só texto.

E confere em cada PNG:
- a última linha escura (texto ou cabeçalho do pé) termina até a linha 1240, onde começa a margem
  de baixo;
- com o espaço da imagem e a tag no topo, o fim do texto mais 48 mais 573 também termina até 1240.
  O espaço é branco no branco, e só a última linha escura não o enxergaria. Com a tag no pé, a última
  linha escura já é a tag, abaixo do espaço, e ela é a medida.

O PNG é lido por um decodificador pequeno no próprio teste (`zlib.inflateSync` e os 5 filtros do PNG,
para RGBA de 8 bits sem entrelaçamento, que é o que o desenho gera). O `sharp` não serve: ele só
existe como dependência opcional do Next, e pô-lo no `package.json` mexeria num arquivo do Vinícius.
O teste também confere a conta contra o próprio desenho, com acentos, hífens de lista e quebras de
linha, e não só contra ela mesma. A régua desenha a manchete de 1 e de 2 linhas, em caixa alta, e o
gancho nos quatro degraus (86, 72, 56 e 46).

---

## A foto da conta em memória

Cada miniatura buscava a foto da conta de novo na Meta, até 3 s cada, e trocar a conta pedia as 10.
A busca passa a ficar em memória, por instância do servidor e por URL:
- **guarda a promessa**, e não só o resultado: as miniaturas chegam juntas, e com a memória vazia
  ainda dariam uma busca cada;
- **validade:** 10 minutos para a foto achada, e curta (30 s) para a falha, para uma queda da Meta
  não grudar;
- **limpeza:** as entradas vencidas saem. A URL da foto muda quando o cron renova a conta, e as chaves
  velhas se acumulariam.

As travas da Etapa 3 continuam as mesmas: só o CDN da Meta, sem seguir redirect, com prazo, teto e
formato pelos bytes. Os testes usam relógio falso.

---

## Sem migração

Tudo cabe nas colunas que já existem (`revisado` e `arte`, de `carrosseis_gerados`). A etapa não tem
DDL, e o deploy dela não tem passo à mão.

---

## Segurança

- Toda action nova começa com `await exigirSessao()`, e a guarda que lê o arquivo de actions cobra
  isso de todas.
- A action de salvar o slide ignora qualquer conta do formulário. A conta, o nome e o @ nunca vêm
  do formulário, e só se gravam em três lugares: no pedido e no "Fixar nesta conta" (a logada, entre
  as conectadas) e no "Gerar de novo" (a do original, mesmo desconectada; sem ela, a logada). As
  actions que gravam num carrossel só completam o nome e o @ da conta que ele já tem, lidos da tabela
  de contas.
- O "Fixar nesta conta" recusa um carrossel que já tem conta.
- A leitura das contas continua só pelas quatro colunas do cabeçalho, nunca o `access_token`.

---

## Testes

| suíte | o quê |
|---|---|
| pura | qual campo é o slide N, nos totais 1, 2, 3 e 10 e no post |
| pura | juntar uma parte ao texto salvo, e recusar só pelos problemas dela |
| pura | a versão por slide: cada entrada do desenho muda a versão daquele slide e não a dos outros |
| pura | a conta nova do "não cabe": a folga de 48px, a manchete de 1 e de 2 linhas, a largura de cada letra no regular e no negrito, a quebra no espaço e depois do hífen, a palavra maior que a linha, o caractere sem desenho, e os vetores combinados com o Labs |
| pura | a tabela de larguras: recalculada dos `.ttf` e igual à versionada |
| pura | a régua: o maior texto de cada degrau, desenhado, termina dentro da área útil |
| pura | a foto em memória: uma busca para chamadas juntas, validade do sucesso e da falha, limpeza, com relógio falso |
| integração | salvar um slide não mexe nos outros; dois salvamentos ao mesmo tempo não se apagam; só carrossel pronto |
| integração | gravar o "só texto" mantém a conta; uma conta no formulário é ignorada; "Fixar nesta conta" grava uma vez e recusa a segunda |
| integração | "Gerar de novo" herda a conta, o nome e o @ do original, mesmo desconectada; o pedido guarda o nome e o @; salvar um slide completa o nome que falta |
| pura | a conta do cabeçalho: conectada usa os dados atuais; desconectada com o nome guardado usa o guardado e as iniciais; sem nome guardado cai na logada |
| tela | editar e salvar um slide; o "não salvo"; só a miniatura do slide salvo troca; a recusa volta sem apagar o que se digitou |
| guardas | toda action começa por `exigirSessao`; nenhum componente novo usa `defaultValue=` |

Como nas etapas anteriores: todo teste escrito antes do código e visto falhar, e as proteções
provadas também retirando-as e vendo o caso certo cair. O código é ensaiado numa cópia isolada antes
do plano, e o plano traz os blocos tirados dessa cópia.

---

## A prova real

No preview, com o Eduardo na tela, e cada gravação com o OK dele (o preview usa o banco de produção):

1. a página em lista, com o editor ao lado de cada miniatura, no computador e no celular;
2. editar e salvar um slide: só a miniatura dele troca, e o resto da página fica;
3. o "não salvo" num slide editado e não salvo;
4. "Fixar nesta conta" num dos carrosséis sem conta;
5. a velocidade das miniaturas com a foto em memória, comparada com a da Etapa 3.

---

## Pré-condições do merge

1. A mudança da conta do "não cabe" combinada com o Labs, com o commit de origem citado.
2. `npm run verify` limpo, a integração verde no container, e o preview com a prova feita.
3. Nenhum `next dev` apontado para a produção durante o deploy, e as abas recarregadas depois.

---

## Fora desta etapa

- O upload dos slides prontos e o envio pelo `/publicar` (Etapa 5).
- O criador de imagem (Etapa 6).
- O carrossel avulso (Etapa 7).
