# Ramificação: o fluxo deixa de ser uma fila e vira um mapa de caminhos

**Data:** 11/08/2026
**Estado:** aprovado
**Base:** `c753fc5`
**Fase:** 2a. As ramificações por texto e por seguidor são fases próprias — ver
*Fora de escopo*.

---

## O problema

O editor em blocos está no ar desde 11/08 e já foi exercitado por um contato
real. Mas o fluxo que ele monta é uma **corrente**: uma mensagem depois da
outra, sem escolha.

O pedido que originou a Fase 1b era maior do que a Fase 1b entregou. Ele foi
levantado assim: que o produto **pareça** um builder de verdade, que dê para
montar fluxos que **ramificam**, e que o dono possa **montar espacialmente**.
Duas das três foram atendidas. Esta fase é a terceira.

E ela é a que o quadro já espera. `no.tsx` carrega, desde a Fase 1b, o
comentário que diz que a segunda alça chega aqui.

## O escopo, e por que ele é fatiado

Foram levantados três tipos de ramificação, e o dono do produto quer os três:

| ramificar por | a pergunta na bifurcação |
|---|---|
| **botões de escolha** | "em qual ela tocou?" |
| o que ela escreveu | "o que ela disse?" |
| se ela segue | "ela segue o perfil?" |

**As três compartilham o mesmo trabalho pesado** — o fluxo virar um mapa — e
diferem só na pergunta feita na bifurcação. Fazê-las juntas seria repetir a
forma que produziu treze defeitos na Fase 1a: mudança grande no motor com três
coisas novas ao mesmo tempo.

**Esta fase entrega o modelo e os botões de escolha.** É a que menos inventa: o
motor já sabe responder "em qual ela tocou", porque desde a Fase 1b o payload do
botão carrega o id do bloco — a mudança que fizemos para o "Já sigo!" saber a
qual portão voltar.

As outras duas entram depois, cada uma acrescentando **uma** forma de pergunta ao
modelo já existente, sem tocar no motor de novo.

## O modelo

`steps` continua sendo a lista de blocos, com a mesma forma de hoje. Nasce uma
**lista de ligações**, e a ordem do array deixa de significar qualquer coisa: quem
manda são as setas.

```jsonc
// automations.steps — inalterado, os blocos ganham `botoes` quando são bifurcação
[
  { "id": "b_bem001", "tipo": "dm", "texto": "Qual você quer?",
    "botoes": [ { "id": "op_a", "rotulo": "Plano básico" },
                { "id": "op_b", "rotulo": "Plano completo" } ] },
  { "id": "b_bas002", "tipo": "dm", "texto": "O básico inclui..." },
  { "id": "b_com003", "tipo": "dm", "texto": "O completo inclui..." },
  { "id": "b_fim004", "tipo": "dm", "texto": "Quer falar com a gente?" }
]

// automations.ligacoes — coluna nova
[
  { "de": "b_bem001", "quando": { "tipo": "botao", "botao": "op_a" }, "para": "b_bas002" },
  { "de": "b_bem001", "quando": { "tipo": "botao", "botao": "op_b" }, "para": "b_com003" },
  { "de": "b_bem001", "quando": { "tipo": "senao" },                 "para": "b_fim004" },
  { "de": "b_bas002", "quando": { "tipo": "sempre" },                "para": "b_fim004" },
  { "de": "b_com003", "quando": { "tipo": "sempre" },                "para": "b_fim004" }
]
```

### Por que arestas explícitas, e não a alternativa mais barata

Havia uma opção de menor mudança: manter a ordem do array como caminho padrão e
só as bifurcações declararem saídas. Nenhuma automação existente migraria, e
`interpretar` quase não mudaria.

**Recusada, e o motivo é o histórico deste projeto.** Ela cria duas formas de
dizer "o próximo": a ordem do array e a saída explícita. Este código já foi
punido três vezes por ter a mesma regra escrita em dois lugares — a virada do dia
em SQL e em TypeScript, a parada dura no interpretador e na prévia, os filtros
nas duas barras. Todas divergiram ou quase. O sintoma aqui seria mensagem indo
pelo caminho errado.

Arestas explícitas também são o que o quadro já implica: o pedido foi draw.io, e
no draw.io **a seta é a verdade**. Hoje o quadro *deduz* setas da ordem do array;
com ligações explícitas ele desenha as que existem — o que é **menos** código no
quadro, não mais.

### O que o formato compra

**A junção sai de graça.** Os dois braços apontam para `b_fim004`, e a mensagem
final não precisa ser repetida em cada braço. Foi decidido aceitar junções
porque o dono do produto ainda não sabe que fluxos vai montar, e um formato que
só aceita árvore obrigaria a descobrir tarde que o dado não cabe.

**O "senão" é uma ligação como as outras**, não um caso especial no motor. Ele
recebe quem responde digitando em vez de tocar. É opcional: sem ele, o fluxo
simplesmente para ali.

**As outras duas ramificações entram sem mexer no modelo.** `quando` ganha
`{"tipo":"texto","palavras":[…]}` e `{"tipo":"segue"}`. Nada mais muda.

## O motor

### O cursor NÃO muda, e isso corrige a spec anterior

A spec da Fase 1b afirmou que a ramificação faria o cursor deixar de ser "onde
ela parou" e virar "em qual caminho, onde ela parou". **Isso está errado**, e o
erro só apareceu ao desenhar esta fase.

O cursor guarda o **id do bloco**. Cada caminho tem blocos próprios, então o id
já diz por onde ela veio. E quando dois braços se juntam, o passado deixa de
importar: uma vez no bloco de junção, o que vem depois é o mesmo para todos.

Ficam intactos: `contacts.flow_step_id`, `cursorDesta`, `indiceDoId`,
`gravarCursor`, `limparCursor`. A parte mais temida da fase não existe.

### O que muda

**`interpretar` segue ligações em vez de somar um.** Hoje anda `i++` até achar um
bloco que espera; passa a seguir a ligação `sempre` até achar um bloco que espera.
Mesma caminhada, outro ponteiro.

O acúmulo do `esperar` acompanha a caminhada, como já faz: os minutos somam ao
longo do caminho percorrido, e um `esperar` que está noutro braço não conta para
quem não passou por ele. Isso cai de graça — o acumulador já é local à
caminhada.

**Nasce uma decisão nova, e ela é pura.** Em `lib/steps.ts`, ao lado das outras:

```ts
export function ligacaoEscolhida(
  ligacoes: unknown,
  deBloco: string,
  oQueAconteceu: { tipo: "botao"; botao: string } | { tipo: "texto" }
): string | null
```

Botão tocado casa com a ligação daquele botão; texto cai no `senao`, se houver.
Sem ligação que sirva, devolve null e o fluxo para onde está — o mesmo que
acontece hoje quando a lista acaba.

**Uma bifurcação é uma parada.** Um bloco com botões espera o toque exatamente
como a mensagem-com-botão de hoje espera. O motor já sabe parar e retomar; nada
muda em `gravarCursor` nem no ramo de retomada.

**O payload do botão ganha o id do botão**, e este ponto é mais delicado do que
parece.

Hoje ele é `AUTO:<automação>:<bloco>`, e `lerPayload` **recusa explicitamente**
mais de três partes. Passa a admitir `AUTO:<automação>:<bloco>:<botão>`, e essa
guarda precisa mudar junto — se ela não mudar, todo botão de bifurcação é
descartado em silêncio.

**Serão três formas válidas ao mesmo tempo, e para sempre:**
`AUTO:<automação>` (anterior à Fase 1b), `AUTO:<automação>:<bloco>` (a Fase 1b) e
`AUTO:<automação>:<bloco>:<botão>` (esta) — duas, três e quatro partes. Um botão entregue
vive na conversa da pessoa indefinidamente — ela pode tocar nele daqui a meses.
Isto **não é dívida a limpar**: é a forma final, e o comentário no código precisa
dizer isso, senão alguém "limpa" os ramos antigos e quebra todo botão já enviado.

**Por que o botão e não o destino.** Seria mais simples o payload nomear
diretamente o bloco de destino — o botão *seria* a ligação. Recusado: isso
congela a decisão no instante do envio, e religar a seta no editor deixaria de
valer para os botões já entregues. Carregando o id do BOTÃO, `ligacaoEscolhida`
resolve contra as ligações de **agora**. É o mesmo princípio que fez o id do
bloco entrar no payload na Fase 1b.

### O ciclo, que a fila tornava impossível

Um grafo pode ter ciclo. `A → B → A` com ligações `sempre` faz `interpretar` andar
para sempre e encher a fila até a memória acabar. Não é hipótese: é a primeira
coisa que um editor livre permite desenhar.

A distinção que decide a regra:

- **Ciclo que passa por uma parada é legítimo e útil** — "menu → opção → volta ao
  menu" é um padrão bom, e a caminhada para na parada.
- **Ciclo só de ligações `sempre` é infinito** — nada o interrompe.

**A regra, e são duas defesas, não uma:**

1. A conferência **recusa salvar** um ciclo de `sempre`. Protege quem monta.
2. `interpretar` carrega um **teto de passos** por caminhada. Protege contra dado
   que entrou por fora do editor — jsonb é editável por fora, e a Fase 1b já
   registrou isso como premissa.

   Batendo no teto, a caminhada **para e registra em Atividade**. Não estoura
   exceção: o webhook aceita o que a Meta mandar, e derrubá-lo faria a Meta
   reenviar o evento por 36 horas. E não segue em silêncio: uma automação que
   anda em círculo precisa aparecer para o dono, senão o sintoma é uma fila que
   cresce sozinha sem explicação.

## O quadro

**As setas passam a ser dado, não dedução.** Sai a lógica que as derivava da
ordem do array.

**A segunda alça aparece.** Um bloco com botões ganha uma alça **por botão**, mais
uma opcional para o "senão". Arrastar da alça de um botão até outro bloco cria a
ligação.

**Ligar deixa de ser proibido.** Foi desligado de propósito na Fase 1b, com o
motivo escrito: não oferecer um gesto que o motor não executa. Agora ele executa.

**Soltar um bloco sobre uma seta muda de significado, não de gesto.** Era
"reordenar o array"; passa a ser "partir esta ligação em duas e entrar no meio".
Some a geometria que existia só para reordenar.

### Uma invariante da Fase 1b cai, e é decisão consciente

A Fase 1b garantia que **todo bloco está sempre na corrente**: soltar num ponto
vazio anexava no fim, e não havia como desconectar. O motivo estava escrito —
bloco solto seria um bloco que nunca roda, e nada na tela explicaria por quê.

Num grafo não existe "o fim" para anexar, e o modelo mental pedido é o do
draw.io, onde se solta a caixa e se liga depois.

Então **bloco solto passa a ser possível**, e a conferência passa a dizer que ele
não é alcançável. Troca uma proibição por um aviso — o mesmo caminho já escolhido
para o link antes do portão.

### A prévia

Mostra **o caminho que leva até o bloco selecionado**, e segue dali. Clicar noutro
braço troca a conversa mostrada.

Foi escolhida sobre as alternativas (um simulador com botões tocáveis; todos os
braços empilhados) porque é sempre relevante ao que se está editando e não cresce
com o número de braços — três braços de três mensagens já seriam nove balões fora
do tronco.

## A conferência, em dois níveis

O grafo cria formas que a fila tornava impossíveis. **Elas não são todas do mesmo
tipo**, e essa distinção é a decisão desta seção:

**Impede SALVAR** — dado que o motor não consegue ler:

- ciclo só de ligações `sempre`
- dois destinos para o mesmo botão (ambiguidade sem resposta certa)
- bloco incompleto (regra que já existe)

**Impede ATIVAR** — fluxo que entregaria errado, mas que é montagem normal
enquanto se trabalha:

- botão sem destino
- bloco inalcançável

**Avisa, sem impedir:**

- bifurcação com um botão só — funciona, mas não é bifurcação

O motivo dos dois níveis: montar um menu de três opções, ligar duas e voltar
amanhã é trabalho normal, e travar o salvar nisso seria hostil. Mas publicar um
botão que não faz nada é a falha silenciosa que este projeto vem combatendo
desde a Fase 1a.

**A máquina já existe.** Na Tarefa 8 da Fase 1b, `toggleAutomation` passou a
rodar `conferirLista` antes de ativar. Ela só precisa aprender a distinguir os
dois níveis.

## A migração

`steps` **não muda de nome nem de forma**. Nasce a coluna `ligacoes`.

Cada automação existente vira uma corrente: bloco 0 → bloco 1 → bloco 2, todas
com `sempre`. Reproduz exatamente a ordem que o array já tinha, então **uma
automação que ninguém abrir continua funcionando igual**.

Script mecânico e idempotente, o terceiro desta série. Os dois anteriores
(`dar-ids-aos-passos`, `converter-cursores`) rodaram em produção sem incidente, e
o roteiro de deploy já tem a forma a seguir.

## Os testes

Tudo que decide vai para `lib/steps.ts`, que é puro, **sem nenhum import**, e
testado: a caminhada pelo grafo, `ligacaoEscolhida`, a detecção de ciclo, as duas
conferências. O motor fica só com o efeito.

É a regra que as duas fases mediram: o arquivo puro atravessou todas as revisões
sem defeito; o `server-only` produziu treze na Fase 1a e zero na Fase 1b, quando
paramos de pôr decisão lá.

**E há uma rede que a Fase 1b criou e esta fase precisa herdar.** A revisão final
da 1b varreu 43.476 casos simulando o motor sobre as funções puras, e provou que
nenhum caminho entrega o link a quem não segue. Com o grafo o espaço cresce muito,
e essa varredura passa a ser o **único** jeito de manter a mesma prova. Ela é
requisito da revisão final desta fase, não item opcional.

## Riscos

**O ciclo é o risco novo, e ele derruba o processo, não uma mensagem.** Uma
caminhada infinita enche a fila. As duas defesas — conferência e teto — existem
porque uma só não cobre dado vindo de fora do editor.

**O espaço de casos explode.** Na fila, um fluxo tinha um caminho. Num grafo com
três bifurcações de três saídas, tem vinte e sete. Toda garantia que a Fase 1b
provou por varredura precisa ser reprovada num espaço maior.

**A conferência em dois níveis é superfície nova para enganar.** Se o nível
errado for aplicado, ou o dono fica travado sem motivo, ou publica quebrado. As
duas listas precisam de teste próprio.

**O motor volta a ser tocado.** Foi o que produziu treze defeitos na Fase 1a. A
mitigação é a mesma que funcionou na 1b: decisão em função pura testada, motor só
com efeito, e revisão que mede em vez de ler.

## Fora de escopo

**Ramificar pelo que ela escreveu** — `quando` ganha `{"tipo":"texto"}`. Fase
própria, e ela não toca no motor: só acrescenta uma forma de pergunta.

**Ramificar por seguir ou não** — o portão de follow devolvendo dois caminhos em
vez de parar. Também fase própria, pelo mesmo motivo.

**Tipos de bloco novos** — mandar imagem, esperar por dias, chamar API externa.

**Desfazer/refazer no quadro** — tentador com um grafo, e não pedido.

**Editar pelo celular** — segue valendo a decisão da Fase 1b: o quadro é de
computador.
