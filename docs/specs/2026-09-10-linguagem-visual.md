# A linguagem visual do MetodoChat

**Nascido em:** 10/09/2026, do pedido do dono depois da auditoria de design:
*"quero uma reformulação estética da UI para melhorar o UX, tirando esse ar de
'AI slop'"*, com alcance de **reformulação ampla** e linguagem própria para o
painel (a marca da N8X existe, e o dono decidiu não herdá-la aqui).
**Estado:** direção aprovada. Entrega em partes.

---

## A tese

O painel **não é um relatório**. É a sala de controle de uma máquina que fala
com pessoas no Instagram enquanto ninguém está olhando — e a lei que governa
tudo nele é a **janela de 24 horas**.

Disso sai a decisão da página inicial: ela responde *"precisa de mim?"*, e
**quando não precisa, fica quase vazia**. O vazio é a resposta, não um espaço a
preencher.

## O que estava errado, e não era gosto

A auditoria de 10/09 mediu; a skill de design nomeia. Ela lista três aparências
em que design gerado por IA se agrupa, e a segunda é *"fundo quase preto com um
único acento vibrante"*. O painel era exatamente isso, e o topo do Início —
número grande, rótulo pequeno, estatística de apoio, gradiente de acento — é o
que ela chama de "a resposta padrão".

**A identidade não foi decidida, foi acumulada.** Não há arquivo de logo; a
fonte é a Sora do Google; o acento é índigo; `/produtos` usa gradiente
índigo→violeta. Cada peça é razoável sozinha, e juntas são o padrão.

## As três perguntas, três lugares

O dono quer as três respostas. Elas têm **ritmos diferentes**, e empilhá-las
numa tela é o que produz o amontoado atual.

| pergunta | onde | ritmo |
|---|---|---|
| precisa de mim? | **Início** | dez vezes por dia; quer estar vazia |
| o que aconteceu? | **Atividade** (já existe) | diário, em ordem de tempo |
| está funcionando? | **Desempenho** (tela nova) | semanal, quer profundidade |

Hoje o gráfico de desempenho está espremido no canto do Início, **sem eixo e sem
valor** — dá para ver a forma, não a grandeza.

---

## O sistema

### 1 · A cor é estado, e mais nada

**O índigo sai** — como cor de marca e como cor de ação. Ele é o que mais fazia
o painel parecer modelo, e o gradiente índigo→violeta de `/produtos` era o pico.
**147 ocorrências** de `indigo`/`violet`/`purple` em mais de 20 arquivos.

No lugar: **a cor sinaliza estado, e uma única superfície é pintada — a da
ação.**

```
--papel    #FBFAF8   fundo, branco morno — NÃO creme
--tinta    #17161A   texto
--acao     #1A5A6C   o preenchimento do botão — petróleo
--traco    #E3E0DA   fio, borda, divisor
--quieto   #6B6862   texto secundário
--aberto   #15803D   janela aberta, deu certo
--fecha    #B45309   prazo curto, atenção
--parou    #B91C1C   falhou
```

### A correção da Parte 1, e ela é do dono

A primeira versão disto dizia "ação usa a própria tinta". Ela foi ao ar na
prévia, e o dono viu o que a leitura não pega: **no tema escuro a tinta resolve
para uma pastilha branca.** Nas palavras dele, *"acho que o branco é uma cor
meio genérica também; alguma cor mista seria melhor"*.

Ele está certo, e o erro não era de gosto — era de raciocínio. Tirar a cor de
marca não é o mesmo que fazer uma escolha; ausência de cor é o padrão de que a
auditoria estava fugindo, não a fuga dele.

**`acao` é petróleo: 194°, azul puxado para o verde — mista no sentido
literal.** As duas alternativas óbvias caíram por medição: ardósia (217°) é o
azul de todo painel de SaaS, e ameixa (286°) é o índigo com outro nome.

O preenchimento **troca de lado entre os temas**, como a tinta já fazia: escuro
sobre página clara, claro sobre página escura. É o que mantém o botão sendo o
maior contraste da tela nos dois — a única coisa que a pastilha branca
acertava. Rótulo em 7,39:1 e 9,12:1.

O tom claro foi corrigido **depois de ver a tela**: a primeira escolha (#14404E)
media bem e lia como preto — 1,61:1 contra a tinta ao lado. O tom que ficou tem
o mesmo croma do par escuro, então a cor tem a mesma intensidade nos dois temas.

**Onde ela vai:** no que se aperta, no que marca a escolha ativa e em todo
contorno de foco. **Onde não vai:** avatar, contador de não lidas, balão
enviado, barra do gráfico, realce da busca e logotipo — dado e identidade
continuam tinta. Pintar dado com a cor da ação é a forma mais rápida de a cor
deixar de querer dizer alguma coisa.

Entram como cores **nomeadas** no `@theme` do Tailwind v4, então a classe diz o
que é (`text-quieto`, `bg-papel`) em vez de `zinc-500`. O nome é metade do
conserto: `zinc-500` não avisa ninguém de que reprova em 4,5:1 no escuro.

**Verde, âmbar e vermelho ficam** com o significado que já têm. O time aprendeu,
e eles estão certos. Trocá-los seria mudança por mudança. Eles continuam sendo
**sinal** — pílula, texto, ponto — e nunca preenchimento grande, que é o que os
separa de `acao` mesmo quando o matiz se aproxima.

**A regra do tom quieto, da Onda 3, continua valendo e agora vale para a paleta
inteira:** nenhuma cor de texto usa o mesmo valor nos dois temas.

### 2 · A tipografia

| papel | família | por quê |
|---|---|---|
| títulos | **Archivo**, corte expandido | cara de placa, de quadro de operação; fora do grupo Inter/Sora/Poppins que aparece em todo painel gerado |
| texto e interface | **IBM Plex Sans** | legibilidade real em corpo pequeno, e este produto é denso de texto |
| tempo e número | **IBM Plex Mono** | timestamps, contagens e identificadores em tabular de verdade; irmã da anterior |

**A Sora sai.** É agradável e é a fonte que aparece em todo modelo de SaaS.

A escala continua com os **oito degraus** e o piso de 11px que a Onda 3 fixou —
`tests/escala.test.ts` já os protege, e o sistema novo nasce preso a eles.

### 3 · A assinatura: a janela vira estrutura

Hoje a janela de 24h é uma pílula verde no canto da conversa. Ela é a **lei do
produto** e está tratada como enfeite.

Passa a ser **um traço no início de toda linha que tem prazo**, cujo
preenchimento é o tempo restante. O olho o lê antes do texto.

```
│████████████░░░░  Marcelo Neves      respondeu há 3 h
│██░░░░░░░░░░░░░░  Carlos Junior      fecha em 2 h
│░░░░░░░░░░░░░░░░  Sonia Vannuchi     fechada
```

Vale em Conversas (janela), Agendados (tempo até publicar) e no lote guardado.

**A fonte do número é `windowState`** (`lib/inbox-window.ts`) — a mesma que o
motor usa para recusar envio. Nenhuma segunda regra de tempo entra no produto.

---

## O que este projeto NÃO faz

- **Não inventa paleta exótica** para parecer diferente. A disciplina é a
  identidade: uma interface de operação não gasta cor com decoração.
- **Não mexe no que a auditoria elogiou:** o celular sem rolagem horizontal em
  390px, os cartões de gatilho de `/automacoes/nova`, a numeração de `/setup`.
- **Não muda vocabulário.** "Sai em", "Seu perfil", "Cancelada por você" foram
  ganhos desta semana e estão certos.
- **Não anima sem motivo.** Movimento serve para mostrar mudança de estado.
- **Não desfaz as Ondas 1 a 3.** Elas consertaram mentira, risco e contraste;
  esta camada é estética e vem por cima.

## A autocrítica que a skill exige

Conferi a direção contra as três aparências padrão que ela nomeia:

- **Creme + serifada + terracota** — não. O fundo é branco morno (#FBFAF8), não
  creme (#F4F1EA); não há serifada; **terracota foi recusada de propósito**, e
  por isso "atenção" é âmbar herdado e não laranja queimado.
- **Quase preto + acento vibrante** — é o que existia. A proposta é o oposto:
  claro, e com **uma** superfície colorida em vez de um acento espalhado. O
  petróleo não é vibrante (croma 0,33 num tom de 194°) e aparece num lugar só:
  o botão. Acento vibrante é cor usada para chamar atenção; esta é cor usada
  para dizer "aqui se aperta".
- **Jornal com fio e raio zero** — é o risco real desta direção, porque "fio
  fino e alta legibilidade" caminha para lá. **Defesa:** mantém raio de canto e
  densidade de aplicativo, não de página impressa, e o traço da janela é
  **preenchimento com significado**, não filete decorativo.

**O risco assumido:** o petróleo e o verde de "janela aberta" são os dois frios
da paleta, e a 52° de distância. O que os separa não é só matiz — é forma:
`aberto` é sempre pílula pequena com ponto, `acao` é sempre preenchimento com
rótulo. `tests/paleta.test.ts` mede a distância de matiz e reprova se alguém a
encurtar; a distância de forma é a disciplina de quem escreve a tela, e está
declarada no cabeçalho de `app/ui.ts`.

---

## A entrega, em partes, para poder parar no meio

1. **O sistema** — cor, tipografia, forma e densidade, aplicados nas telas como
   elas estão hoje. Nenhum layout muda de lugar.
2. **O Início** refeito: responde "precisa de mim?" e fica vazio quando não.
3. **Desempenho**, tela nova, com o gráfico ganhando eixo e valor.
4. **A assinatura** — o traço da janela, onde houver prazo.
5. **Contatos e as duas telas longas** (`/eventos`, 6819px; `/contatos`,
   8777px), que são os achados D4, D5 e M6 da auditoria.

## Restrições herdadas, que valem aqui

- **A suíte não testa componente.** Decisão sai do JSX e vira função ou token
  com teste.
- **`tests/escala.test.ts` e `tests/texto-quieto.test.ts` são portões**, não
  sugestões: a paleta nova tem de passar neles, e eles sobem junto.
- **`lib/steps.ts` não tem NENHUM import.**
- **A janela de 24h tem UMA fonte: `windowState`.**
- Nunca rodar `next build` nem `npm run dev`.
