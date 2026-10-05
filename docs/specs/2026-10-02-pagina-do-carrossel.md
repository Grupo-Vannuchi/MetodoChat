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
| a conta nos dois projetos | os mesmos casos de teste (os vetores), cada projeto com a sua conta |
| a instrução do carrossel | até 5 linhas de corpo com manchete (4 com fechamento), com o texto que o Labs escreve (decidido na sessão do Labs) |
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
mesmo `SlideParaArte` e do mesmo `CabecalhoDaArte` que a rota desenha: a manchete e o texto, o tipo,
o número, o total, o "só texto" daquele slide e o cabeçalho (nome, @ e foto). Salvar o slide 1 pede
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
- **Gravar o "só texto" não pode apagar a conta.** Hoje `salvarEscolhasDaArte` troca o objeto
  `arte` inteiro (`set arte = $2::jsonb`). Ela dá lugar a `salvarSoTextoDaArte`, que grava só a
  chave `soTexto` (`arte || …`), e um caso de integração prova que a conta fica, com uma prova de
  mutação.

A spec descreve esses grupos pela condição (tem conta e não tem nome; não tem conta), e não pela
lista: a lista muda enquanto a Etapa 3 está no ar.

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
altura, inclusive o lado da foto do cabeçalho (127); a altura sem ilustração (955) não muda.

Os 48px de baixo, com o cabeçalho no pé, não são uma segunda causa: com a tag no topo ou no pé, o
respiro de 48px entre a tag e o texto já está nos 175 do cabeçalho (127 + 48), que deixa de ser uma
estimativa (`CABECALHO_ESTIMADO`) e passa a ser a soma das duas constantes. Nos dois casos sobram
334px com o espaço da imagem.

### A manchete ocupa no mínimo 77px

O desenho dá à manchete `marginBottom: max(0, 77 − round(fonte × 1,32))` (`AVANCO_MANCHETE`), e a
conta a tratava como uma linha comum. A 34px, a conta via 45px e o desenho gastava 77. A conta passa
a dar à manchete de n linhas `n × round(fonte × 1,32) + max(0, 77 − round(fonte × 1,32))`. Com uma
linha, isso é 77 (até a fonte em que a linha passa de 77); com duas, `round(fonte × 1,32) + 77`. O
`AVANCO_MANCHETE` vai para a geometria, como os intervalos.

### A composição do slide, uma só

O desenho e a conta passam a partir da MESMA lista de linhas, `composicaoDoSlide(titulo, texto)`
(`lib/bonus/arte-composicao.ts`, pura, roda no navegador): cada linha com o texto, o peso, o
espaçamento e o espaço acima dela (nada, o avanço da manchete ou o intervalo de parágrafo de 41px).
A regra do negrito sai do desenho e mora nela. Antes, a conta media um texto montado à parte
(`textoMedido`), e foi uma conta assim que divergiu do desenho no Labs em `1254847`. O Labs fez o
mesmo na 48.1 dele, com outra forma; o contrato entre os dois são os vetores, e não o código.

A normalização mora na composição e roda uma vez; o desenho e a conta recebem o texto pronto.
Combinada com o Labs em 02/10:
- (a) NFC no texto inteiro: o Satori põe o espaçamento do negrito por glifo, e o acento em NFD é um
  glifo a mais;
- (b) as sete quebras obrigatórias do quebrador do Satori (`\r\n`, `\r`, `\v`, `\f`, U+0085, U+2028 e
  U+2029) viram `\n`. Sem isso ele quebraria a linha sem a conta ver, e `\r\n\r\n` não separava
  parágrafo;
- (c) em cada linha, espaços e tabs seguidos viram um espaço, e as pontas saem;
- (d) parágrafo é a linha vazia contada depois do (c): a linha só de espaços também separa (antes,
  ela virava uma linha de 0px);
- (e) a manchete perde as quebras, e manchete só de espaços é manchete nenhuma (antes, o desenho
  desenhava a margem dela e a conta não a via).

### A largura real de cada letra, quebrando como o Satori

Em caixa alta e fonte grande, a conta previa uma linha a menos. A causa principal é a quebra: a 116px
cabem uns 13 caracteres por linha, e a palavra que não cabe vai inteira para a linha de baixo. A
conta por caractere não via isso. Mas quebrar por palavra com a largura média de hoje (0,5538 do
corpo, a média das maiúsculas da Carlito Regular) deixava a conta conservadora demais: medida nos
carrosséis da produção, ela encolhia peças que cabiam, como um gancho de 64 caracteres de 72 para
56px, e não via o negrito, que é 2,5% mais largo (achado 71).

A conta (`lib/bonus/arte-medida.ts`) repete o que o Satori 0.25.0 do og do Next 16.3.8 faz, lido no
código dele e conferido no desenho, sem folga. A revisão cética do Labs achou seis regras, e o Chat
conferiu cada uma no quebrador e no desenho:
1. **A largura** de um texto é a soma da largura de cada grafema, medido sozinho, e por isso o kerning
   nunca entra. A do grafema é, glifo a glifo, `avanço × (1 / 2048 × fonte)`, mais
   `(espaçamento / fonte) × fonte`, nesta ordem de operações (a do opentype.js). Com a tabela em
   unidades da fonte e a mesma ordem, a soma em ponto flutuante dá o mesmo valor que a do Satori.
2. **O negrito** usa a tabela do Bold e é 0,4px mais apertado por glifo (achado 71).
3. **O grafema com algum caractere fora da fonte vale 1em**, sem espaçamento: o emoji vira imagem do
   tamanho da fonte. O caractere sem desenho que não é emoji vai buscar fonte na rede, e aí a conta é
   aproximada.
4. **A quebra** é gulosa, nos pedaços que o quebrador do Satori (UAX#14, pacote `linebreak`) entrega,
   cada um com o espaço do fim: a palavra cabe quando `linha + palavra ≤ 860 + espaços do fim dela`.
   A conta quebra em cada espaço, menos onde o quebrador cola: antes de `! ) , . / : ; ? ] }`,
   depois de `( [ { ¡ ¿ „ ‚`, entre aspa e um desses que abrem, e entre dois travessões. Medido no
   quebrador real, em todos os pares de 230 caracteres em volta de um espaço: só esses quatro colam.
5. **A altura da linha** é `round(fonte × 1,32)`: 46 → 61, 34 → 45. O intervalo de parágrafo é 41.
6. **A palavra mais larga que a linha não quebra** (a arte não pede `wordBreak`) e vaza pela direita:
   o degrau em que isso acontece não cabe.

O Satori também quebra DENTRO da palavra: depois do hífen entre letras ("palavra-" "chave"), em
volta do travessão e do emoji colados, depois de `?`, `/` e `…` seguidos de letra (a URL). A conta
não quebra aí. Com menos pontos de quebra, a quebra gulosa nunca termina uma linha antes, então,
nesses textos, a conta só erra para o lado seguro: pode escolher um degrau menor, nunca um maior.

`alturaEstimada` e `LARGURA_DO_CARACTERE` saem; o comentário que dizia que a conta "erra para o lado
seguro" sai com elas.

**A tabela não é cópia à mão.** Um script na pasta da fonte (`lib/bonus/fonte/gerar-larguras.ts`,
roda no `node` puro) a gera a partir dos `.ttf` versionados (google/fonts `3dd7884402`), em unidades
da fonte, os inteiros do arquivo, com o Regular e o Bold juntos (`lib/bonus/arte-larguras.ts`). Um
teste a recalcula dos `.ttf` e compara o arquivo byte a byte. Uma fonte trocada sem tabela nova, ou
uma tabela editada à mão, derruba o teste. A tabela serve também ao Labs: ele busca a Carlito na hora pela API do Google
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

Com as seis regras e a composição, a conta foi conferida no ensaio contra os 138 vetores desenhados
(abaixo): nos 132 em que o texto só quebra no espaço, ela dá o mesmo degrau, o mesmo "cabe" e a mesma
altura do desenho, ao pixel, inclusive em quatro linhas a menos de 0,05px de 860 e num gancho que só
cabe a 86px pelo espaçamento do negrito. Os 6 restantes quebram dentro da palavra, e ali a conta errou
só para o lado seguro.

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
- os dois projetos conferem o MESMO arquivo de vetores.

Código copiado garante igualdade no dia da cópia; vetores compartilhados garantem o mesmo resultado
nos dias seguintes. O "sem mudar uma linha do Labs em `45bc973`" da Etapa 3 deixa de valer para a
geometria, os slides e o desenho, e o cabeçalho de cada arquivo passa a citar os vetores. Sem isso,
repete-se o que aconteceu com o aviso do Labs em `1254847`, que divergiu do desenho.

**Os vetores** (`tests/vetores-da-arte.json`), combinados com o Labs em 02/10:
- cada vetor é um slide pedido (texto, tipo, manchete, com ou sem o espaço, tag no pé ou não) e o
  que o DESENHO responde: o maior degrau em que cabe (ou o piso), a altura da coluna do texto nesse
  degrau e se cabe. O valor esperado sai do desenho no Satori, e não de uma conta: duas contas
  escritas pela mesma regra erram nos mesmos pontos;
- o Chat gera o arquivo desenhando cada vetor; o Labs o confere desenhando no Satori de lá (a 48.5
  dele, depois da conta exata);
- cada vetor diz se é **exato** (o texto só tem ponto de quebra no espaço) ou **conservador**. Quem
  decide é o quebrador do próprio Satori, numa caixa de 1px de largura, e não um rótulo à mão. No
  exato, a conta tem de dar o mesmo degrau, o mesmo "cabe" e a mesma altura. No conservador, o
  degrau da conta é menor ou igual, a conta nunca diz que cabe quando o desenho não cabe, e há um
  caso em que ela erra por uma linha inteira (um "palavra-chave" no fim da linha);
- o arquivo é o mesmo, byte a byte, nos dois repositórios, e cada um confere o sha256 dele. Ele é
  todo em ASCII (todo caractere acima de U+007E sai escapado): o espaço sem quebra, a quebra de
  parágrafo e o acento combinante dos vetores não se veem, e uma ferramenta que regrave o arquivo
  pode trocá-los sem ninguém ver;
- o cabeçalho do arquivo registra de onde ele saiu (o sha256 do og, das duas fontes e do
  `arte-desenho.tsx`), a normalização, a ordem das operações da conta e como a altura foi medida,
  com a tolerância declarada da margem direita;
- as categorias pedidas pelo Labs: os 4 casos que ele desenhou na comparação, emoji, pontuação com
  espaço antes, parágrafos (`\n\n`, `\r\n`, linha só de espaços, U+2028), linha encostando em 860 dos
  dois lados, palavra mais larga que a linha, acento em NFD, o espaço sem quebra, e o gancho que só
  cabe pelo espaçamento do negrito.

### A régua, como teste

O "pronto quando" é o da Etapa 48 do Labs, e aqui ele vira um teste automático: os vetores da
régua são o maior texto que a conta aceita em cada degrau, para:
- os três estilos: frase, caixa alta e lista;
- o gancho, o conteúdo com manchete de 1 e de 2 linhas (em caixa alta), a chamada com a tag no pé
  e o post;
- os dois modos: com espaço e só texto.

O teste (`tests/bonus-arte-desenho.test.ts`) desenha cada vetor de novo, com a coluna do texto e o
espaço da imagem pintados de preto (o espaço é branco no branco, e a última linha escura não o veria),
e confere no PNG:
- a altura da coluna, na borda direita da área útil, é a do arquivo;
- cabe quando a última linha com algum escuro fica acima de 1240, onde começa a margem de baixo, e
  nada vaza pela direita. Vazar é tinta em x ≥ 980, com tolerância declarada de 10px além dos 970 da
  área útil, porque a tinta de uma letra pode passar do avanço dela; na conta, sem tolerância;
- cabe se e só se a altura não passa de 334 (ou 955) e nada vaza: o limite da geometria é o que o
  pixel mostra;
- o degrau de cima não cabe;
- o "exato" do arquivo é o que o quebrador diz.

O emoji vem da rede no desenho (o og busca o SVG em cdn.jsdelivr.net). No teste, um SVG fixo responde
por ele: a largura do emoji é 1em, seja qual for o desenho.

O PNG é lido por um decodificador pequeno no próprio teste (`zlib.inflateSync` e os 5 filtros do PNG,
para RGBA de 8 bits sem entrelaçamento, que é o que o desenho gera). O `sharp` não serve: ele só
existe como dependência opcional do Next, e pô-lo no `package.json` mexeria num arquivo do Vinícius.
O teste leva uns 20 segundos.

### A instrução do carrossel: até 5 linhas de corpo

No piso de 34px, com a manchete e o espaço da imagem, cabem `77 + n × 45 ≤ 334`: 5 linhas de corpo, e
4 com a linha de fechamento (+41). A instrução de hoje pede que a lista caiba "nas 6 linhas do slide",
e um slide assim invade calado (o caso de 6 linhas do Labs). Decidido pelo Eduardo na sessão do Labs:
a instrução passa a pedir até 5 linhas de corpo com manchete (4 com fechamento). A instrução do
carrossel é cópia da do Labs e o prefixo dela é cacheado: o texto sai do Labs, que o manda ao Chat
byte a byte ANTES de publicar (a 48.6 dele). Nada na instrução muda antes de o texto chegar, e a fase
que a aplica fica por último no plano.

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
| pura | a composição: as linhas, o negrito, o espaço acima de cada uma, e a normalização (a)–(e) |
| pura | a conta nova do "não cabe": a largura em unidades da fonte no regular e no negrito, o emoji de 1em, os quatro casos em que o espaço não quebra, a linha que soma exatamente 860, o espaço do fim, a palavra maior que a linha, a altura arredondada, a manchete e o parágrafo |
| pura | a tabela de larguras: recalculada dos `.ttf` e igual à versionada, byte a byte |
| pura | os vetores: o sha256 combinado, as fontes, as categorias, e a conta contra cada vetor (igual no exato, do lado seguro no conservador) |
| pura | a régua: cada vetor desenhado de novo no Satori daqui dá a altura e o cabe do arquivo, termina acima de 1240, e o degrau de cima não cabe |
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

1. A mudança da conta do "não cabe" combinada com o Labs, com o commit de origem citado, e o arquivo
   dos vetores com o mesmo sha256 nos dois repositórios.
2. A instrução de até 5 linhas aplicada com o texto que o Labs mandou, byte a byte.
3. `npm run verify` limpo, a integração verde no container, e o preview com a prova feita.
4. Nenhum `next dev` apontado para a produção durante o deploy, e as abas recarregadas depois.

---

## Fora desta etapa

- O upload dos slides prontos e o envio pelo `/publicar` (Etapa 5).
- O criador de imagem (Etapa 6).
- O carrossel avulso (Etapa 7).
