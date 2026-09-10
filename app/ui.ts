// Design system compartilhado (claro + escuro).
// Strings simples: funcionam em componentes de servidor e de cliente.
//
// Princípios desta versão:
// - Superfícies calmas: borda sutil + sombra baixa, sem "caixa dentro de caixa".
// - Um único tom de destaque (indigo) para ação; verde só para sucesso real.
// - Foco sempre visível (ring), porque contorno de foco é acessibilidade.
// - Escala de espaçamento e raio consistentes para a interface parecer única.

/* ---------- superfícies ---------- */

export const card =
  "rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-zinc-800 dark:bg-zinc-900/70 dark:shadow-none";

// Cartão de leitura (métricas, listas) com leve elevação no hover.
export const cardHover =
  "transition-[box-shadow,border-color] duration-200 hover:border-zinc-300 hover:shadow-[0_4px_16px_-6px_rgba(0,0,0,0.10)] dark:hover:border-zinc-700";

// Superfície interna: agrupa campos relacionados dentro de um cartão.
export const subtle =
  "rounded-xl border border-zinc-200/70 bg-zinc-50/60 dark:border-zinc-800/80 dark:bg-zinc-950/40";

export const divider = "border-t border-zinc-200/80 dark:border-zinc-800";

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
//   zinc-600 no claro   pior caso 7,02:1 (sobre `bg-zinc-100`, o corpo)
//   zinc-400 no escuro  pior caso 5,68:1 (sobre `bg-zinc-800`, o balão recebido)
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
export const tomQuieto = "text-zinc-600 dark:text-zinc-400";

// `text-[22px]` saiu: 22px era um degrau só dele, e a rampa 20->24 (`text-xl`
// no celular, `text-2xl` a partir de 640px) usa dois degraus que a escala já
// tem. No celular o título fica 2px MENOR do que era, e o sentido da mudança
// é de propósito: a auditoria elogiou "nenhuma página rola na horizontal em
// 390px", e não há como conferir isso sem renderizar — então a troca que
// sobrou é a que não pode piorar aquilo.
export const pageTitle =
  "text-xl font-bold tracking-[-0.01em] text-zinc-900 sm:text-2xl dark:text-zinc-50";

export const pageSubtitle = `mt-1 text-sm ${tomQuieto}`;

export const muted = tomQuieto;

export const eyebrow = `text-[11px] font-semibold uppercase tracking-[0.08em] ${tomQuieto}`;

/* ---------- formulários ---------- */

export const label = "mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200";

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
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-[border-color,box-shadow] placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:ring-indigo-500/15";

// Campo com erro: a borda vermelha aparece junto da mensagem no próprio campo.
export const inputError =
  "border-red-400 focus:border-red-500 focus:ring-red-500/10 dark:border-red-800";

export const fieldError = "mt-1.5 text-xs font-medium text-red-600 dark:text-red-400";

/* ---------- botões ---------- */

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-[background-color,transform,box-shadow] hover:bg-indigo-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500/15 active:scale-[0.985] dark:border-zinc-700 dark:bg-transparent dark:text-zinc-200 dark:hover:bg-zinc-800/60";

export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500/15 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/15 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40";

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
  "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800";

// A DESTRUTIVA. O defeito que ela conserta: em repouso "Excluir" era
// `zinc-500` nos DOIS temas enquanto as irmãs eram `zinc-600`/`zinc-400` — a
// ação que apaga era a MENOS legível da linha, e no escuro ficava em 3,91:1,
// abaixo do mínimo de 4,5:1.
//
// O PAR `red-700`/`red-400` não é inventado: é o mesmo de `badgeErr`, logo
// abaixo. E ele foi escolhido MEDIDO, contra o fundo real de cada tema (claro:
// `bg-white`; escuro: `bg-zinc-900/70` sobre preto, = rgb(17,17,19)):
//
//   claro  red-700  6,42:1 em repouso, 5,87:1 sobre o `bg-red-50` do hover
//   escuro red-400  6,53:1 em repouso, 6,34:1 sobre o `bg-red-950/40` do hover
//
// `red-600` no claro foi RECUSADO por medição, e não por gosto: 4,77:1 em
// repouso (quase o 4,83:1 do `zinc-500` que estava lá, ou seja, não consertava
// nada) e 4,36:1 sobre o vermelho do hover — abaixo do mínimo justamente no
// estado em que a pessoa está prestes a clicar.
export const btnLinhaDanger =
  "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40";

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

// A LINHA ENQUANTO A AÇÃO CORRE. Aqui a opacidade fica, porque ela diz uma
// coisa que nada mais na linha diz — "esta linha está trabalhando" —, mas
// no valor MEDIDO, e não no que estava lá.
//
// Era `opacity-60`, o mesmo 2,90:1 do D11 aplicado à linha inteira durante a
// ida ao servidor. Em `opacity-80` o texto quieto da linha fica em 4,59:1 no
// claro e 5,00:1 no escuro — acima do mínimo nos dois. Os botões continuam
// `disabled` (e `disabled:opacity-50` por cima), que é o estado em que a WCAG
// não cobra contraste; o que esta troca protege é o resto da linha, que
// continua sendo texto que a pessoa lê enquanto espera.
export const linhaOcupada = "opacity-80";

export const link =
  "font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 transition-colors hover:decoration-indigo-500 dark:text-indigo-400 dark:decoration-indigo-700";

/* ---------- selos ---------- */

export const badge =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold";

export const badgeNeutral = `${badge} bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400`;
export const badgeOk = `${badge} bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400`;
export const badgeWarn = `${badge} bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400`;
export const badgeErr = `${badge} bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400`;

/* ---------- tabelas ---------- */

export const tableWrap =
  "overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-zinc-800 dark:bg-zinc-900/70 dark:shadow-none";

export const thead = `bg-zinc-50/80 text-[11px] font-semibold uppercase tracking-[0.04em] dark:bg-zinc-950/50 ${tomQuieto}`;

export const rowDivide = "divide-y divide-zinc-100 dark:divide-zinc-800/60";

export const rowHover = "transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30";

/* ---------- avisos ---------- */

const alertBase = "rounded-xl border px-4 py-3 text-sm";

export const alertError = `${alertBase} border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300`;

// Sucesso em verde: indigo é a cor de ação, e usar indigo para "deu certo"
// confundia confirmação com botão.
export const alertOk = `${alertBase} border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300`;

export const alertWarn = `${alertBase} border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300`;

export const alertInfo = `${alertBase} border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300`;

/* ---------- estados ---------- */

export const skeleton = "animate-pulse rounded-xl bg-zinc-200/70 dark:bg-zinc-800/60";

export const emptyWrap =
  "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700";
