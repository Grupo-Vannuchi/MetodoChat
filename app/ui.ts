// Design system compartilhado (claro + escuro).
// Strings simples: funcionam em componentes de servidor e de cliente.
//
// Princípios desta versão:
// - Superfícies calmas: borda sutil + sombra baixa, sem "caixa dentro de caixa".
// - A COR SINALIZA ESTADO; SÓ UMA SUPERFÍCIE É PINTADA, E É A DA AÇÃO. O
//   índigo saiu como cor de marca. Por uma versão a ação usou a própria tinta,
//   e no tema escuro isso virava uma pastilha BRANCA — genérica pelo mesmo
//   motivo que o índigo era. Entrou `acao`, o petróleo (194°, azul puxado para
//   o verde). Verde, âmbar e vermelho ficam com o significado que já têm, e
//   continuam sendo SINAL: pílula, texto, ponto — nunca preenchimento grande.
// - ONDE `acao` VAI, E ONDE NÃO VAI: vai no que se aperta (botão primário,
//   botão de entrar, botão de passo), no que marca a escolha ativa (chip de
//   filtro, cartão de gatilho, item da barra lateral) e em TODO contorno de
//   foco, porque foco é a mesma promessa do botão. NÃO vai no que é dado nem
//   no que é identidade: avatar, contador de não lidas, balão enviado, barra
//   do gráfico, realce da busca e logotipo continuam tinta. Pintar dado com a
//   cor da ação é a forma mais rápida de a cor deixar de querer dizer algo.
// - Foco sempre visível (ring), porque contorno de foco é acessibilidade.
// - Escala de espaçamento e raio consistentes para a interface parecer única.
//
// AS CORES SÃO NOMEADAS (`papel`, `tinta`, `acao`, `traco`, `quieto`,
// `aberto`, `fecha`, `parou`), e a definição de cada uma — com o contraste
// medido ao lado
// — está em `app/globals.css`. O portão é `tests/paleta.test.ts`.

/* ---------- superfícies ---------- */

export const card =
  "rounded-2xl border border-traco bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-traco-escuro dark:bg-zinc-900/70 dark:shadow-none";

// Cartão de leitura (métricas, listas) com leve elevação no hover.
// O HOVER PRECISA DE UM FIO MAIS FORTE QUE O DE REPOUSO, e a paleta nomeia UM
// fio só. O tom vem então do `quieto` a 40% sobre a superfície, e não de um
// oitavo nome: medido, ele dá 1,62:1 sobre o branco, contra 1,48:1 do
// `zinc-300` que estava aqui — o fio do hover fica um pouco MAIS visível do que
// era. Derivar de uma cor nomeada é o oposto de inventar uma.
export const cardHover =
  "transition-[box-shadow,border-color] duration-200 hover:border-quieto/40 hover:shadow-[0_4px_16px_-6px_rgba(0,0,0,0.10)] dark:hover:border-quieto/40";

// Superfície interna: agrupa campos relacionados dentro de um cartão.
// `bg-papel` DENTRO do cartão branco: a superfície interna é o tom da PÁGINA
// afundado no cartão, e não um cinza a mais. A troca é de nome e não de pixel —
// `bg-zinc-50/60` sobre branco dava rgb(252,252,252), e `papel` é
// rgb(251,250,248).
export const subtle =
  "rounded-xl border border-traco/70 bg-papel dark:border-traco-escuro/80 dark:bg-papel-escuro/40";

export const divider = "border-t border-traco dark:border-traco-escuro";

/* ---------- tipografia ---------- */

// O TOM DO TEXTO QUIETO — legenda, explicação de campo, cabeçalho de tabela,
// rótulo de seção. É UM SÓ, e ter um só é o conserto do achado D3.
//
// O DEFEITO ERA A REGRA, E NÃO O TOM: `hint`, `thead` e `eyebrow` escreviam
// `text-zinc-500 dark:text-zinc-500` — a MESMA cor nos dois temas —, e o
// rótulo de seção da barra lateral escrevia `text-zinc-400 dark:text-zinc-600`,
// que é a mesma ideia ao contrário. Só `muted` trocava de tom por tema, e por
// isso só ele passava. Texto quieto que não troca de tema erra num dos dois
// SEMPRE: o fundo mudou e ele não.
//
// MEDIDO CONTRA OS QUINZE FUNDOS REAIS DO PRODUTO (a lista está em
// `tests/medidor.ts`, e o teste é `tests/texto-quieto.test.ts`):
//
//   quieto no claro          pior caso 5,05:1 (sobre `bg-zinc-100`, o balão)
//   quieto-escuro no escuro  pior caso 5,71:1 (sobre `bg-zinc-800`, o balão)
//
// O PAR NOMEADO SUBSTITUIU `zinc-600`/`zinc-400`, e a troca não é só de nome:
//
//   no ESCURO ela não custa nada — 5,71:1 contra os 5,68:1 do `zinc-400`. Mesma
//     luminância, temperatura diferente, e o portão continua exatamente onde
//     estava.
//   no CLARO ela custa margem, e o número tem de estar escrito: eram 7,02:1 e
//     passam a ser 5,05:1. O mínimo é 4,5:1, então sobram 0,55 — mas a folga
//     encolheu, e quem for propor um `quieto` mais claro precisa saber que o
//     orçamento acabou. A cor é a da spec aprovada (#6B6862); o que esta linha
//     faz é não deixar o custo dela virar surpresa.
//
// OS NÚMEROS DE ANTES, para o defeito não se perder: `zinc-600` dava 7,02:1 no
// pior fundo claro e `zinc-400` dava 5,68:1 no pior fundo escuro.
//
// O QUE ESTAVA LÁ, medido nos mesmos fundos: `zinc-500` nos dois temas falha em
// NOVE dos quinze — 4,39:1 sobre o corpo claro, 3,91:1 sobre o cartão escuro,
// 3,09:1 sobre o balão recebido. O mínimo é 4,5:1.
//
// DUAS SAÍDAS MAIS BARATAS FORAM RECUSADAS POR MEDIÇÃO, e não por gosto:
//   `zinc-500`/`zinc-400` (mexer só no escuro) — continua em 4,39:1 sobre o
//     corpo claro, que é o fundo de metade das telas.
//   `zinc-600`/`zinc-500` (mexer só no claro) — continua reprovando nos oito
//     fundos escuros, de 4,12:1 a 3,09:1.
// E `zinc-700`/`zinc-300` foi recusado pelo lado oposto: 10,44:1 e 12,76:1 é o
// contraste do texto NORMAL desta interface. Texto quieto que grita deixa de
// ser quieto, e o achado pedia legibilidade, não hierarquia invertida.
export const tomQuieto = "text-quieto dark:text-quieto-escuro";

// `text-[22px]` saiu: 22px era um degrau só dele, e a rampa 20->24 (`text-xl`
// no celular, `text-2xl` a partir de 640px) usa dois degraus que a escala já
// tem. No celular o título fica 2px MENOR do que era, e o sentido da mudança
// é de propósito: a auditoria elogiou "nenhuma página rola na horizontal em
// 390px", e não há como conferir isso sem renderizar — então a troca que
// sobrou é a que não pode piorar aquilo.
// `titulo` é a utilidade que aplica a Archivo no corte EXPANDIDO — o eixo
// `wdth`, definido em `app/globals.css`. Ela entra aqui, e não numa classe de
// peso, porque expandido não é peso: é um eixo da fonte variável, e nenhum
// corte estático da Archivo o tem.
export const pageTitle =
  "titulo text-xl font-bold tracking-[-0.01em] text-tinta sm:text-2xl dark:text-tinta-escuro";

export const pageSubtitle = `mt-1 text-sm ${tomQuieto}`;

export const muted = tomQuieto;

// TEMPO, NÚMERO E IDENTIFICADOR — a IBM Plex Mono, com os dígitos tabulares.
//
// POR QUE É UM TOKEN, e não `font-mono tabular-nums` solto no JSX: as duas
// classes andam SEMPRE juntas neste produto, e separá-las é o começo de "aqui
// eu esqueci o tabular". Contagem que muda de largura enquanto atualiza é
// exatamente o defeito que dígito tabular existe para evitar.
//
// ELE VEM DEPOIS DE `${muted}` NAS COMPOSIÇÕES, e isso não é estilo: `muted`
// não declara família nem `font-variant-numeric`, então as duas famílias de
// classe não se cruzam e a ordem na folha não decide nada aqui (ver o aviso
// medido junto de `input`, mais abaixo).
export const numero = "font-mono tabular-nums";

export const eyebrow = `text-[11px] font-semibold uppercase tracking-[0.08em] ${tomQuieto}`;

/* ---------- formulários ---------- */

// `zinc-800`/`zinc-200` era meio degrau abaixo do texto normal, e o meio degrau
// morreu junto com o resto da rampa: nesta paleta o texto é TINTA ou é QUIETO, e
// rótulo de campo é tinta — quem lê um formulário lê o rótulo, não o adivinha.
export const label = "mb-1.5 block text-sm font-medium text-tinta dark:text-tinta-escuro";

export const hint = `mt-1.5 text-xs leading-relaxed ${tomQuieto}`;

// AVISO MEDIDO NESTA BRANCH (categoria-do-contato): compor `className` com
// `${input}` empilhando a MESMA família de classe que `input` já define
// (`w-*`, `px-*`, `py-*`, `rounded-*`, `text-*`) NÃO FUNCIONA por ordem no
// className — quem desempata é a ordem na FOLHA que o Tailwind gera, não a
// ordem das classes na string. Foi assim que o campo de categoria em
// `app/conversas/[id]/page.tsx` saiu em largura cheia quando devia ser
// compacto: `w-36 rounded-lg px-2 py-1 text-xs ${input}` perdia
// w-36/rounded-lg/px-2/py-1 para w-full/rounded-xl/px-3.5/py-2.5 (só text-xs
// escapava, por coincidência alfabética — "sm" vem antes de "xs"). Resolvido
// ali com o modificador `!` (`w-36! rounded-lg! px-2! py-1! text-xs!`), que
// desempata por IMPORTÂNCIA em vez de depender da ordem da folha — ver o
// comentário completo naquele arquivo, junto do className.
//
// Os outros dois usos do projeto escapam por sorte, não por método:
// `flex-1 ${input}` (app/conversas/[id]/reply-form.tsx) não compartilha
// família nenhuma com `input`; `${input} pl-9` (app/automacoes/list-client.tsx)
// funciona porque o Tailwind ordena o lado único (`pl-*`) DEPOIS do atalho
// (`px-*`) na folha — não porque `pl-9` vem depois na string.
//
// Não há teste nem lint que avise disto. Ao empilhar sobre `input` uma classe
// da MESMA família, use o modificador `!` na classe nova; caso contrário o
// resultado depende de uma ordem de folha que ninguém aqui controla.
export const input =
  "w-full rounded-xl border border-traco bg-white px-3.5 py-2.5 text-sm text-tinta outline-none transition-[border-color,box-shadow] placeholder:text-quieto/70 focus:border-acao focus:ring-4 focus:ring-acao/15 dark:border-traco-escuro dark:bg-papel-escuro/60 dark:text-tinta-escuro dark:placeholder:text-quieto-escuro/60 dark:focus:border-acao-escuro dark:focus:ring-acao-escuro/20";

// Campo com erro: a borda vermelha aparece junto da mensagem no próprio campo.
export const inputError =
  "border-parou focus:border-parou focus:ring-parou/15 dark:border-parou-escuro dark:focus:border-parou-escuro dark:focus:ring-parou-escuro/20";

export const fieldError = "mt-1.5 text-xs font-medium text-parou dark:text-parou-escuro";

/* ---------- botões ---------- */

// A AÇÃO É O PETRÓLEO, e é aqui que o índigo mais se via — e, depois dele, o
// branco. Medido: `papel` sobre `acao` dá 7,39:1 no claro, e `papel-escuro`
// sobre `acao-escuro` dá 9,12:1 no escuro. O preenchimento troca de lado entre
// os temas (escuro no claro, claro no escuro), que é o que mantém o botão sendo
// o maior contraste da tela nos dois — a única coisa que a pastilha branca
// acertava. O portão dos dois números é `tests/paleta.test.ts`.
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-acao px-4 py-2.5 text-sm font-semibold text-papel shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-[background-color,transform,box-shadow] hover:bg-acao/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acao/30 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 dark:bg-acao-escuro dark:text-papel-escuro dark:hover:bg-acao-escuro/90 dark:focus-visible:ring-acao-escuro/30";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-traco bg-white px-4 py-2.5 text-sm font-semibold text-tinta transition-colors hover:bg-papel focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acao/25 active:scale-[0.985] dark:border-traco-escuro dark:bg-transparent dark:text-tinta-escuro dark:hover:bg-traco-escuro/60";

export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-traco px-3 py-1.5 text-xs font-medium text-tinta transition-colors hover:bg-traco/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acao/25 dark:border-traco-escuro dark:text-tinta-escuro dark:hover:bg-traco-escuro/70";

export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-parou/35 px-3 py-1.5 text-xs font-medium text-parou transition-colors hover:bg-parou/8 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-parou/15 dark:border-parou-escuro/35 dark:text-parou-escuro dark:hover:bg-parou-escuro/10";

// AÇÃO DE TEXTO DENTRO DE LINHA DE LISTA — três ou quatro no fim da mesma
// linha, sem borda, e por isso NÃO é `btnDanger`.
//
// POR QUE `btnDanger` NÃO SERVE AQUI, medido no lugar em que ele é usado hoje
// (`app/publicar/agendados`, um botão solto dentro de um cartão): ele carrega
// `border border-red-300` e `px-3`. Numa linha em que "Pausar", "Editar" e
// "Duplicar" são texto puro com `px-2.5`, "Excluir" viraria a ÚNICA caixa
// desenhada da linha — o elemento mais chamativo, e não o mais claro —, e a
// lista de 18 automações viraria uma coluna de caixas vermelhas. O pedido era
// o contrário: distinguir sem gritar. O que `btnDanger` traria de útil (o
// `hover:bg-red-50 dark:hover:bg-red-950/40`) a linha já tinha.
//
// AS DUAS COMPARTILHAM A GEOMETRIA — mesmo raio, mesmo padding, mesmo tamanho
// e mesmo peso. A diferença entre elas é SÓ o tom, e é de propósito: é o que
// impede a ação destrutiva de virar o elemento mais pesado da linha.
export const btnLinha =
  "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 text-quieto hover:bg-traco/40 dark:text-quieto-escuro dark:hover:bg-traco-escuro/70";

// A DESTRUTIVA. O defeito que ela conserta: em repouso "Excluir" era
// `zinc-500` nos DOIS temas enquanto as irmãs eram `zinc-600`/`zinc-400` — a
// ação que apaga era a MENOS legível da linha, e no escuro ficava em 3,91:1,
// abaixo do mínimo de 4,5:1.
//
// O PAR PASSOU A SER `parou`/`parou-escuro`, e a troca foi de NOME e não de
// tom: `parou` é #B91C1C e `parou-escuro` é #F87171 — os mesmos vermelhos que
// `red-700` e `red-400` desenhavam. Medido contra o fundo real de cada tema
// (claro: `bg-white`; escuro: `bg-zinc-900/70` sobre `papel-escuro`):
//
//   claro  parou         6,47:1 em repouso, 5,66:1 sobre o `bg-parou/8` do hover
//   escuro parou-escuro  6,65:1 em repouso, 5,84:1 sobre o `bg-parou-escuro/10`
//
// Eram 6,42:1 e 6,53:1 com `red-700`/`red-400`. O hover deixou de ser
// `bg-red-50`/`bg-red-950/40` e passou a ser a própria cor do estado a 8% e a
// 10% — o fundo do hover deixa de depender de uma rampa que a paleta não nomeia.
//
// `red-600` no claro foi RECUSADO por medição, e não por gosto: 4,77:1 em
// repouso (quase o 4,83:1 do `zinc-500` que estava lá, ou seja, não consertava
// nada) e 4,36:1 sobre o vermelho do hover — abaixo do mínimo justamente no
// estado em que a pessoa está prestes a clicar.
export const btnLinhaDanger =
  "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 text-parou hover:bg-parou/8 dark:text-parou-escuro dark:hover:bg-parou-escuro/10";

// O CONTEINER DAS ACOES DE UMA LINHA DE LISTA. Ele não tem opacidade, e a
// ausência é o conserto do achado D11 — por isso ele é um token e não quatro
// classes soltas no JSX.
//
// O DEFEITO: o contêiner carregava `sm:opacity-60`, o padrão de "revelar no
// hover". A cor DECLARADA das quatro ações passava; a cor VISTA não, porque
// `opacity` multiplica o galho inteiro. Medido em produção, a ≥640px, em
// repouso: as quatro ações de todas as 18 linhas em 2,90:1 (e "Excluir", antes
// da Onda 2, em 2,31:1). O mínimo é 4,5:1.
//
// POR QUE O PADRÃO INTEIRO CAIU, E NÃO SÓ O NÚMERO. A pergunta certa era qual
// opacidade ainda aprova as quatro; a resposta, medida contra o tom de cada
// tema (`zinc-600`/`zinc-400` e `red-700`/`red-400`) e o fundo de cada tema:
//
//   opacidade 0,60   2,90 | 3,32 | 3,45 | 3,03   reprova as quatro
//   opacidade 0,75   4,07 | 4,53 | 4,66 | 4,12   reprova duas
//   opacidade 0,80   4,59 | 5,00 | 5,07 | 4,54   passa, e a mais fraca fica
//                                                em 4,50 — margem zero
//
// Ou seja: o único valor que aprova é 0,80, e 0,80 não se vê. O efeito só
// existe enquanto for ilegível. Um recurso que precisa estar quebrado para
// funcionar não é um recurso — é o defeito com outro nome.
//
// E ELE JÁ CUSTAVA MAIS DO QUE ENTREGAVA: em repouso, quem não passa o mouse —
// tela de toque a partir de 640px, e quem navega por teclado antes de o foco
// entrar na linha — não via as quatro ações da lista inteira.
//
// O QUE FICA NO LUGAR, e já estava lá: `cardHover` levanta a linha no hover
// (borda e sombra), e `btnLinha` acende o fundo da ação sob o cursor. A
// hierarquia entre o nome da automação e as ações continua sendo feita pelo
// TOM (`zinc-900` contra `zinc-600`), que é onde ela sempre coube.
export const acoesDaLinha = "flex shrink-0 items-center gap-1";

// A LINHA ENQUANTO A AÇÃO CORRE — e AQUI A OPACIDADE CAIU, três ondas depois de
// o D11 ter derrubado a irmã dela. A regra que a derrubou é a mesma, e o que
// mudou foi só o número que a alimenta.
//
// A HISTÓRIA, em duas linhas: era `opacity-60` (2,90:1, o próprio D11 aplicado à
// linha inteira); a Onda 2 a mediu e a subiu para `opacity-80`, em que o tom
// quieto de então (`zinc-600`, 7,02:1 de folga) ficava em 4,59:1 — acima do
// mínimo por 0,09.
//
// O QUE A PARTE 1 FEZ COM AQUELE 0,09: o tom quieto passou a ser `quieto`
// (#6B6862), que é 25 pontos mais claro que o `zinc-600`. Refeita a conta com o
// tom novo, sobre o cartão branco, NENHUMA opacidade que se veja aprova:
//
//   0,80   3,63:1     0,85   4,00:1     0,90   4,46:1     0,95   4,95:1
//
// O mínimo é 4,5:1, e o único valor que passa é 0,95 — cinco por cento de
// escurecimento, que ninguém enxerga. É EXATAMENTE o achado do D11 outra vez:
// um efeito que só funciona enquanto for ilegível não é um efeito.
//
// POR QUE O TOM NÃO FOI ESCURECIDO NO LUGAR DA OPACIDADE: para o dim de 0,80
// voltar a passar, `quieto` teria de ser mais escuro que #4E4C48 — mais escuro
// que o próprio `zinc-600` que saiu, e a Onda 3 já havia RECUSADO por medição um
// quieto naquela faixa ("quieto que grita deixa de ser quieto"). Consertar o
// efeito arruinando o tom seria pagar o texto de todas as telas pelo dim de uma.
//
// O QUE FICA NO LUGAR, e diz a mesma coisa sem tocar em contraste: o fundo da
// linha muda (`traco` a 40% no claro e `traco-escuro` a 70% no escuro) e o cursor vira
// `wait`. Medido sobre esse fundo, o tom quieto fica em 5,00:1 no claro e
// 7,4:1 no escuro. Os botões continuam `disabled` com `disabled:opacity-50`, que
// é o estado em que a WCAG não cobra contraste.
//
// O `!` NÃO É ENFEITE: `card` já declara `bg-white` e `dark:bg-zinc-900/70`, e
// empilhar a MESMA família de classe não desempata pela ordem na string — ver o
// aviso medido junto de `input`. Aqui quem tem de ganhar é o estado.
export const linhaOcupada = "cursor-wait bg-traco/40! dark:bg-traco-escuro/70!";

// O LINK TAMBÉM PERDE O ÍNDIGO, e o que o distingue do texto ao redor passa a
// ser o SUBLINHADO — que é o que sempre distinguiu link em texto corrido, e o
// único sinal que funciona para quem não separa matiz.
export const link =
  "font-medium text-tinta underline decoration-quieto/50 underline-offset-2 transition-colors hover:decoration-tinta dark:text-tinta-escuro dark:decoration-quieto-escuro/50 dark:hover:decoration-tinta-escuro";

/* ---------- tendência ---------- */

// O ACHADO D7, E ELE ERA DOIS DEFEITOS NA MESMA LINHA.
//
// DE CONTRASTE: a subida usava `emerald-600`, medido em 3,65:1 sobre o cartão
// branco — abaixo dos 4,5:1. A auditoria NÃO o consertou na Onda 3, e escreveu
// o motivo: `emerald-600` era o verde de sucesso do sistema inteiro, e trocá-lo
// num lugar só criaria um SEGUNDO verde. A paleta nomeada desfez o impasse —
// `aberto` (#15803D) É o verde do sistema e mede 4,56:1.
//
// DE HIERARQUIA: a queda tinha exatamente a cor do texto ao lado (os dois em
// `muted`), então "↓ 23" e "vs. 7 dias antes" liam como uma frase só e o número
// perdia estatuto de número. A assimetria de COR fica de propósito — queda não
// é falha, e vermelho alarmaria sobre algo que não quebrou —, mas o que separa
// os dois passa a ser peso e família, não matiz.
//
// ELES SÃO TOKEN E NÃO CLASSE SOLTA porque é assim que `tests/paleta.test.ts`
// os alcança: a suíte não testa componente, e uma string exportada é o que dá
// para prender.
export const tendenciaSobe = `font-semibold ${numero} text-aberto dark:text-aberto-escuro`;
export const tendenciaCai = `font-semibold ${numero} text-tinta dark:text-tinta-escuro`;

/* ---------- selos ---------- */

export const badge =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold";

export const badgeNeutral = `${badge} bg-traco/50 text-quieto dark:bg-traco-escuro dark:text-quieto-escuro`;

// O SELO DA ESCOLHA ATIVA, e ele existe para consertar um uso errado de cor de
// estado: `/contatos` marcava o filtro selecionado com `badgeOk`, ou seja, com
// o VERDE que quer dizer "janela aberta, deu certo". Um filtro selecionado não
// é um estado do produto — é uma escolha de quem está olhando —, e gastar a cor
// do sinal com ela desgasta o sinal. Preenchido, como o segmento marcado de
// `/eventos` e `/automacoes`, porque é o mesmo gesto e agora tem a mesma cara.
// Medido: rótulo em 7,39:1 no claro e 9,12:1 no escuro.
export const badgeAcao = `${badge} bg-acao text-papel dark:bg-acao-escuro dark:text-papel-escuro`;
// OS TRÊS SELOS DE ESTADO FICAM COMO ESTÃO, E A RECUSA É MEDIDA — não é
// esquecimento. A tentação era escrever `bg-aberto/12 text-aberto` e deixar a
// classe dizer o nome do estado. Medido contra o fundo que essa conta produz,
// ela reprova:
//
//   `text-aberto` sobre `bg-aberto/12`    4,25:1
//   `text-aberto` sobre `bg-aberto/10`    4,39:1
//   `text-aberto` sobre `bg-aberto/8`     4,51:1   (margem 0,01)
//   `text-aberto` sobre `bg-emerald-100`  4,42:1
//
// O mínimo é 4,5:1. `aberto` (#15803D) PASSA nos quinze fundos reais do produto
// — o que ele não aguenta é a própria tinta por baixo, porque um fundo derivado
// da mesma cor sobe a luminância do fundo e não a do texto.
//
// O que passa é o par que já estava aqui (`emerald-700` sobre `emerald-100`,
// 4,72:1), e a spec diz com todas as letras que verde, âmbar e vermelho FICAM
// com o significado que têm. Inventar um `aberto-tenue` só para a classe
// combinar seria inventar paleta — que é o que esta direção recusa.
export const badgeOk = `${badge} bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400`;
export const badgeWarn = `${badge} bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400`;
export const badgeErr = `${badge} bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400`;

/* ---------- tabelas ---------- */

export const tableWrap =
  "overflow-x-auto rounded-2xl border border-traco bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-traco-escuro dark:bg-zinc-900/70 dark:shadow-none";

export const thead = `bg-papel/80 text-[11px] font-semibold uppercase tracking-[0.04em] dark:bg-papel-escuro/50 ${tomQuieto}`;

export const rowDivide = "divide-y divide-traco/60 dark:divide-traco-escuro/60";

export const rowHover = "transition-colors hover:bg-papel/70 dark:hover:bg-traco-escuro/30";

/* ---------- avisos ---------- */

const alertBase = "rounded-xl border px-4 py-3 text-sm";

export const alertError = `${alertBase} border-parou/30 bg-red-50 text-parou dark:border-parou-escuro/30 dark:bg-red-950/60 dark:text-parou-escuro`;

// O AVISO USA O TOM NOMEADO, E O SELO NÃO — e a diferença é medida, não de
// gosto: o fundo do aviso é o `-50` (quase branco) e o do selo é o `-100`.
//
//   `text-aberto` sobre `bg-emerald-50`   4,76:1   passa
//   `text-aberto` sobre `bg-emerald-100`  4,42:1   reprova
//   `text-fecha`  sobre `bg-amber-50`     4,84:1   passa
//   `text-parou`  sobre `bg-red-50`       5,91:1   passa
//
// Onde o tom nomeado passa, ele entra e a classe diz o estado; onde reprova, o
// par antigo fica. É a mesma regra dos dois lados, e o que decide é o número.
export const alertOk = `${alertBase} border-aberto/30 bg-emerald-50 text-aberto dark:border-aberto-escuro/30 dark:bg-emerald-950/60 dark:text-aberto-escuro`;

export const alertWarn = `${alertBase} border-fecha/30 bg-amber-50 text-fecha dark:border-fecha-escuro/30 dark:bg-amber-950/60 dark:text-fecha-escuro`;

// O AVISO NEUTRO PERDE O ÍNDIGO E NÃO GANHA COR NENHUMA. Ele nunca disse
// estado — dizia "leia isto" —, e numa paleta em que cor é estado, informação
// sem estado é papel, traço e tinta.
export const alertInfo = `${alertBase} border-traco bg-papel text-tinta dark:border-traco-escuro dark:bg-papel-escuro/50 dark:text-tinta-escuro`;

/* ---------- estados ---------- */

export const skeleton = "animate-pulse rounded-xl bg-traco/70 dark:bg-traco-escuro/70";

export const emptyWrap =
  "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-traco px-6 py-12 text-center dark:border-traco-escuro";
