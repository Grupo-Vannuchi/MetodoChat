// A VARREDURA DO PORTÃO: existe caminho que entregue um link a quem não segue?
//
// Ela é a rede da garantia central do produto, e existe porque a prova anterior
// morreu. A revisão final da Fase 1b percorreu 43.476 casos sobre as funções
// puras e mostrou que nenhum caminho entregava o link a quem não segue — só que
// aquela prova era sobre um fluxo em FILA, e a Fase 2a transformou o fluxo num
// GRAFO. Com bifurcação, junção e setas que saltam posições, a prova antiga não
// fala mais do sistema que está no ar.
//
// COMO RODAR:
//
//   npm run varredura                 (o modo normal, e o que o `verify` roda)
//   node scripts/varredura-portao.mjs --antigo <caminho/para/steps-antigo.ts>
//
// ELA ESTÁ NO `npm run verify`, e a decisão tem número: a varredura completa
// leva ~35 segundos, contra os minutos do `next build` que o `verify` já roda.
// Não vale a pena montar um modo de amostra para o `verify` e guardar a completa
// para "sob demanda": amostra é um segundo número para manter, e "sob demanda"
// é o mesmo que não rodar. Uma prova que ninguém roda não protege nada, e esta é
// a única prova que o produto tem da promessa central. Se um dia ela passar de
// um minuto, o corte certo é reduzir os ARRANJOS (hoje 10 por topologia), que é
// o eixo mais redundante — não sortear topologias.
//
// A CONTRAPROVA fica de fora do `verify` por um motivo prático: ela precisa de
// um arquivo que não está no repositório. Para rodá-la:
//
//   git show 99e7b93:lib/steps.ts > /tmp/steps-99e7b93.ts
//   node scripts/varredura-portao.mjs --antigo /tmp/steps-99e7b93.ts
//
// E ela não é formalidade: uma varredura que dá zero vazamentos e zero na
// contraprova não provou nada — provou que não mede. O modo `--antigo` carrega o
// lib/steps.ts de ANTES da Tarefa 3b (o arquivo de verdade, tirado do git, e não
// uma reimplementação) e reproduz a cola do motor daquele commit. Ele TEM que
// acusar, em A e em C, e sai com código 1 se não acusar.
//
// OS PLANTIOS que esta varredura precisa acusar, e os números medidos — eles são
// o critério de que ela DISCRIMINA, e não um enfeite. Refazê-los é o teste do
// teste, e quem mexer aqui deve refazê-los:
//
//   `haCaminho` contando só setas `sempre`      A: 0        C:  2.713.648
//   `retomadaDoFallback` sem a regra             A: 0        C:     91.200
//   `retomadaDoEmailConhecido` sem a regra       A: 0        C:  1.102.772
//   a regra do portão desligada por completo     A: 73.720   C: 15.091.792
//
// Repare que TRÊS DOS QUATRO deixam A em ZERO. Foi por isso que C existe: até a
// revisão desta tarefa a varredura tinha só A e B, e A só acusava o interruptor
// geral — os outros três passavam com código de saída 0. O porquê está escrito
// lá embaixo, na separação dos grupos.
//
// E repare que B NÃO SE MEXE em nenhum dos quatro (261.536 sempre). Isso NÃO é
// "mudança de código nunca aparece em B" — a revisão plantou `seguinteDe`
// devolvendo a primeira ligação de saída de QUALQUER tipo (mudança de código
// puro, nenhuma REGRA envolvida) e mediu B saltar de 261.536 para 321.008, com
// a varredura saindo em código 0 e imprimindo "SEM VAZAMENTO" — contraexemplo
// medido, não hipotético.
//
// O que É verdade, e o que este arquivo mede: nenhuma REGRA pode disparar em
// B, porque o portão não está a montante do destino. É essa afirmação, e só
// ela, que sustenta B ficar fora do código de saída — B mede a MONTAGEM; A e C
// medem a REGRA.
//
// O QUE ELA NÃO COBRE, dito para o número não valer mais do que vale:
//
//   - A cola do motor é REESCRITA aqui, porque lib/engine.ts é `server-only` e
//     nenhum teste o alcança. Ela foi copiada de lá linha a linha, mas é cópia:
//     se lib/engine.ts mudar e esta não, a varredura passa a medir outra coisa.
//   - `checkFollowsAccount` devolvendo null (a Meta indisponível) LIBERA a
//     passagem por decisão registrada em lib/engine.ts. É falha aberta
//     deliberada, não vazamento, e por isso a pessoa simulada aqui é sempre
//     alguém que NÃO SEGUE e cuja consulta responde.
//   - Cinco blocos por fluxo. Fluxos maiores existem; o que esta varredura
//     afirma é sobre a forma das ligações, não sobre o tamanho.

import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const argAntigo = process.argv.indexOf("--antigo");
const MODO_ANTIGO = argAntigo !== -1;
const CAMINHO_STEPS = MODO_ANTIGO
  ? resolve(process.argv[argAntigo + 1])
  : resolve(import.meta.dirname, "../lib/steps.ts");

const S = await import(pathToFileURL(CAMINHO_STEPS).href);

// A escrita do payload de botão, do jeito que o sistema a faz.
//
// NO MODO ANTIGO A FUNÇÃO NÃO EXISTE — `payloadDoBotao` nasceu na revisão da
// Tarefa 4, e o arquivo carregado pela contraprova é anterior a ela. Ali a
// interpolação à mão é o que é FIEL ao commit medido: a contraprova tem que
// reproduzir aquele código, não este. O `??` é essa fidelidade, não um remendo
// defensivo — no modo ATUAL ele nunca é usado, e se um dia for, a varredura
// volta a medir a própria ideia dela de payload em vez da do sistema.
const montarPayload =
  S.payloadDoBotao ?? ((automacao, bloco, botao) => `AUTO:${automacao}:${bloco}:${botao}`);

// ---------------------------------------------------------------------------
// OS BLOCOS. Cinco papéis, e cada um está aqui por um motivo:
//
//   E  a `dm` de resposta rápida — o único bloco que emite botão, e portanto a
//      única origem possível de um toque.
//   G  o portão. Um só por fluxo, que é o que `conferirLista` permite.
//   L  o LINK. É o que não pode sair sem o portão; é a pergunta inteira.
//   M  uma `dm` comum, para haver braço sem nada de especial nele.
//   P  o pedido de e-mail, porque o motor tem um ramo que PULA esse bloco
//      (e-mail já conhecido) e esse ramo é um dos seis pontos convertidos.
// ---------------------------------------------------------------------------
const BLOCOS = {
  E: { id: "b_ee00001", tipo: "dm", texto: "escolha", botao_label: "quero" },
  G: { id: "b_gg00002", tipo: "pedir_follow", texto: "me segue", botao_label: "Já sigo!" },
  L: { id: "b_ll00003", tipo: "dm", texto: "toma", url: "https://x.y" },
  M: { id: "b_mm00004", tipo: "dm", texto: "um bloco qualquer" },
  P: { id: "b_pp00005", tipo: "pedir_email", texto: "seu e-mail?" },
};
const PAPEIS = ["E", "G", "L", "M", "P"];
const ID = Object.fromEntries(PAPEIS.map((p) => [p, BLOCOS[p].id]));

// Alcançabilidade escrita AQUI, e não importada de lib/steps.ts, de propósito:
// se a varredura usasse `haCaminho` para decidir quais fluxos medir, ela estaria
// perguntando ao réu se o crime aconteceu. Este BFS é independente e serve só
// para escolher os casos.
function alcanca(ligacoes, de, para, so_sempre = false, sem = null) {
  const vistos = new Set([de]);
  const fila = [de];
  while (fila.length) {
    const atual = fila.shift();
    for (const l of ligacoes) {
      if (l.de !== atual) continue;
      if (so_sempre && l.quando.tipo !== "sempre") continue;
      if (l.para === sem) continue;
      if (l.para === para) return true;
      if (!vistos.has(l.para)) {
        vistos.add(l.para);
        fila.push(l.para);
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// OS FLUXOS. As setas são geradas por produto cartesiano sobre cada saída:
//
//   E  uma `sempre` (ou nenhuma) e DOIS botões — é daí que saem a bifurcação e,
//      quando os dois apontam para o mesmo bloco, a junção.
//   M  uma `sempre` e um botão, para haver bifurcação num braço também.
//   G, L, P  uma `sempre` cada.
//
// A ordem do ARRAY varia à parte, e ela decide duas coisas que a caminhada não
// decide: quem é a ENTRADA (`steps[0]`) e em que índice o portão está.
// ---------------------------------------------------------------------------
function* topologias() {
  const outros = (p) => PAPEIS.filter((q) => q !== p);
  const comNada = (ps) => [null, ...ps];
  for (const eSempre of comNada(outros("E")))
    for (const eBotaoA of outros("E"))
      for (const eBotaoB of outros("E"))
        for (const gSempre of comNada(outros("G")))
          for (const lSempre of comNada(outros("L")))
            for (const mSempre of comNada(outros("M")))
              for (const mBotao of comNada(outros("M")))
                for (const pSempre of comNada(outros("P"))) {
                  const ls = [];
                  const sempre = (de, para) =>
                    para && ls.push({ de: ID[de], quando: { tipo: "sempre" }, para: ID[para] });
                  const botao = (de, b, para) =>
                    para &&
                    ls.push({ de: ID[de], quando: { tipo: "botao", botao: b }, para: ID[para] });
                  sempre("E", eSempre);
                  botao("E", "op_aaaaaa", eBotaoA);
                  botao("E", "op_bbbbbb", eBotaoB);
                  sempre("G", gSempre);
                  sempre("L", lSempre);
                  sempre("M", mSempre);
                  botao("M", "op_cccccc", mBotao);
                  sempre("P", pSempre);
                  yield ls;
                }
}

// As ordens de array medidas. Rotações cobrem "cada papel é a entrada uma vez";
// a invertida existe para o portão cair antes e depois do link no array sem que
// as ligações mudem — é a diferença entre "está antes na lista" e "está no
// caminho", que é a troca inteira desta tarefa.
const ARRANJOS = [];
for (let r = 0; r < PAPEIS.length; r++) {
  ARRANJOS.push(PAPEIS.map((_, i) => PAPEIS[(i + r) % PAPEIS.length]));
  ARRANJOS.push(PAPEIS.map((_, i) => PAPEIS[(PAPEIS.length - 1 - i + r) % PAPEIS.length]));
}

// ---------------------------------------------------------------------------
// A COLA DO MOTOR, nas duas versões. É lib/engine.ts reescrito, e só a parte que
// decide — nada de banco, nada de Meta.
//
// A pessoa simulada NÃO SEGUE o perfil. Então `resolverFollow` devolve "barrar"
// (ou "soltar", que também para), e em toda situação em que o portão é avaliado
// a execução PARA ali. É por isso que a única pergunta que importa é: o que foi
// entregue ANTES de qualquer portão ser avaliado?
// ---------------------------------------------------------------------------
const TETO_RECURSAO = 10;

// A UNIDADE MEDIDA É O SALTO, não o ponto de entrada, e a diferença é causal.
// Uma execução pode montar MAIS DE UMA retomada: a de entrada, e as que ela
// monta por dentro (hoje só a do e-mail já conhecido). Cada uma vale por si —
// cada uma responde por o que foi entregue ENQUANTO ELA VALIA.
//
// FORAM PRECISAS DUAS MEDIÇÕES para chegar nisto, e as duas estão escritas
// porque as duas formas erradas são tentadoras:
//
//   OLHAR SÓ O PONTO DE ENTRADA cega a varredura para o salto de dentro.
//     Desfazer a correção do e-mail já conhecido — o defeito central desta
//     tarefa — deixava A e C em ZERO e só engordava B (261.536 -> 714.908): o
//     vazamento acontecia no salto, e o grupo era decidido pela entrada.
//   MARCAR A EXECUÇÃO INTEIRA se QUALQUER salto dela for do grupo C acusa
//     vazamento no lugar errado, e mede 32.040 deles com o código CERTO. O caso:
//     `M -sempre-> LINK -sempre-> P(e-mail)`. O link sai na entrada, que é do
//     grupo B; o salto do e-mail vem DEPOIS e é do grupo C. A regra não tinha
//     como impedir o que já havia saído antes dela existir.
//
// Cada salto, então, registra só a entrega que aconteceu debaixo dele. `rotulo`
// identifica QUAL salto é este — o ponto de entrada na chamada de fora, ou o
// nome do salto interno na chamada recursiva (abaixo, no ramo `pedir_email`) —
// porque um exemplo de vazamento tem que apontar o salto que vazou, não o
// ponto de entrada que a recursão começou percorrendo.
function executar(passos, ligacoes, retomada, regraSeAplica, gateado, medidas, profundidade = 0, rotulo = "entrada") {
  if (profundidade > TETO_RECURSAO) return;

  const medida = {
    grupo: gateado ? "A" : fechaPelaRegra(passos, ligacoes, retomada, regraSeAplica) ? "C" : "B",
    retomada,
    rotulo,
    vazou: false,
  };
  medidas.push(medida);

  if (retomada.portao !== null) {
    const portao = S.passoEsperado(passos, retomada.portao);
    // Falha fechada: portão que não resolve para um `pedir_follow` válido PARA
    // e registra, sem entregar nada.
    if (portao?.tipo !== "pedir_follow") return;
    // Não segue: barra. Nada mais é entregue.
    return;
  }

  const partida = MODO_ANTIGO
    ? S.identidadeNoIndice(passos, retomada.destino)
    : retomada.destino;
  const r = S.interpretar(passos, ligacoes, partida);

  for (const acao of r.enfileirar) {
    const p = acao.passo;
    if (p.tipo === "pedir_follow") return; // avaliado, e barrado
    if (p.tipo === "pedir_email") {
      // O motor pula este bloco quando `contacts.email` já é conhecido. Os dois
      // ramos são simulados, e o que continua é o que entrega mais.
      //
      // ESTE É O SEXTO PONTO, e a correção dos achados da revisão está nesta
      // linha: no modo ATUAL ele passa por `retomadaDoEmailConhecido`, que
      // devolve uma `Retomada` COM a regra do portão. Antes ele montava
      // `{ portao: null, destino }` à mão nos dois modos — reproduzindo, no modo
      // ATUAL, o vazamento que o motor tinha.
      const seguinte = MODO_ANTIGO
        ? { portao: null, destino: acao.indice + 1 }
        : S.retomadaDoEmailConhecido(passos, ligacoes, acao.indice);
      // A regra SE APLICA a este salto nos dois modos: o grupo é definido por
      // onde a regra DEVE fechar, e o modo ANTIGO é justamente o código em que
      // ela não fechava.
      executar(passos, ligacoes, seguinte, true, gateado, medidas, profundidade + 1, "e-mail já conhecido (retomada interna)");
      return;
    }
    if (p.tipo === "dm" && p.url) medida.vazou = true;
  }
}

// Todo ponto por onde alguém volta a um fluxo, do jeito que lib/engine.ts os
// monta. É a lista que a Tarefa 3b converteu, e por isso ela é a lista que
// precisa ser varrida.
//
// `regraSeAplica` diz se a REGRA DO PORTÃO chega a ser consultada naquele ponto,
// e é o que separa C de B lá embaixo. Ela é verdadeira nos cinco pontos de
// RETOMADA — os que passam por `atravessandoOPortao` (lib/steps.ts) — e falsa no
// GATILHO, que entra pela porta da frente.
function pontosDeEntrada(passos, ligacoes) {
  const pontos = [];
  const empurrar = (nome, retomada, regraSeAplica = true) =>
    retomada && pontos.push({ nome, retomada, regraSeAplica });
  const entrada = MODO_ANTIGO ? 0 : S.identidadeNoIndice(passos, 0);

  // O gatilho: palavra-chave, comentário, resposta de story. Ele NÃO passa pela
  // regra do portão, e isso é decisão de produto, não esquecimento — está
  // registrado em `executarFluxo` (lib/engine.ts).
  //
  // MEDIDO, porque a diferença entre "não passa" e "devia passar" é o tipo de
  // coisa que esta varredura existe para resolver: classificar o gatilho como
  // ponto em que a regra fecha produzia 34.940 "vazamentos", e TODOS eram o
  // gatilho — nenhum dos cinco pontos de retomada aparecia. Olhando um deles:
  //
  //   entrada M ;  M -sempre-> LINK ;  portão -sempre-> LINK
  //   LINK -sempre-> P -sempre-> M      (é por aqui que o portão "alcança" M)
  //
  // O portão alcança a entrada dando a volta PELO PRÓPRIO LINK. A pessoa que
  // dispara a automação recebe o link sem nunca chegar perto do portão — mas
  // quem abriu essa porta foi o DONO, desenhando `entrada -sempre-> link` sem
  // portão no meio. É falha de MONTAGEM, e o lugar dela é B.
  //
  // E APLICAR A REGRA AQUI SERIA PIOR, não melhor: bastaria uma seta de volta
  // (`link -botão-> boas-vindas`, "quero outro") para o portão passar a alcançar
  // a entrada em QUALQUER fluxo, e aí todo mundo que dispara a automação
  // receberia o pedido de follow como PRIMEIRA mensagem, sem nunca ver a
  // boas-vindas. A porta da frente é o único ponto em que "não há nada antes por
  // onde passar" continua verdadeiro depois do grafo.
  empurrar("gatilho", { portao: null, destino: entrada }, false);

  // Todo toque em todo botão. Um botão entregue vive na conversa da pessoa
  // indefinidamente, então todos são tocáveis a qualquer momento.
  //
  // O PAYLOAD É MONTADO PELA FUNÇÃO DE PRODUÇÃO (`payloadDoBotao`), e não à mão
  // como até a revisão da Tarefa 4. Aqui havia `AUTO:A:${l.de}:${l.quando.botao}`
  // escrito neste arquivo — ou seja, a varredura forjava o toque com a SUA
  // ideia do payload, e não com a do sistema. Enquanto isso fosse verdade, ela
  // não podia dizer nada sobre a entrega: a revisão trocou o id do botão pelo
  // do bloco em lib/engine.ts e esta varredura saiu idêntica, porque ela nunca
  // tinha visto aquela linha. É a mesma razão pela qual a cola do motor daqui
  // é a limitação declarada lá em cima — só que esta metade tinha conserto.
  for (const l of ligacoes) {
    if (l.quando.tipo !== "botao") continue;
    const p = S.lerPayload(montarPayload("A", l.de, l.quando.botao));
    const c = S.caminhoDoBotao(p, passos, ligacoes);
    if (!c) continue;
    if (MODO_ANTIGO) {
      // O buraco medido: índice CRU para `executarFluxo`, que o embrulha em
      // `{portao: null, destino}` e pula a regra do portão por inteiro.
      if (c.indice !== undefined) empurrar(`botao ${l.quando.botao} de ${l.de}`, {
        portao: null,
        destino: c.indice,
      });
    } else if (c.retomada) {
      empurrar(`botao ${l.quando.botao} de ${l.de}`, c.retomada);
    }
  }

  // Todo cursor possível, pelos três ramos que o leem.
  const cursores = [
    { passoId: null, automationId: null },
    { passoId: ID.E, automationId: "B" }, // cursor de OUTRA automação
  ];
  for (let i = 0; i < passos.length; i++) {
    cursores.push({ passoId: S.identidadeDoPasso(passos[i], i), automationId: "A" });
  }
  for (const cursor of cursores) {
    empurrar(
      `AUTO: cursor ${cursor.passoId}/${cursor.automationId}`,
      MODO_ANTIGO
        ? S.retomadaDoBotao(cursor, "A", passos)
        : S.retomadaDoBotao(cursor, "A", passos, ligacoes)
    );
    empurrar(
      `FOLLOW: cursor ${cursor.passoId}/${cursor.automationId}`,
      MODO_ANTIGO
        ? S.retomadaDoFollow(cursor, "A", passos)
        : S.retomadaDoFollow(cursor, "A", passos, ligacoes)
    );
  }
  for (let i = 0; i < passos.length; i++) {
    empurrar(
      `texto parado em ${i}`,
      MODO_ANTIGO ? S.retomadaDoTexto(passos, i) : S.retomadaDoTexto(passos, ligacoes, i)
    );
  }

  // O fallback.
  const f = S.retomadaDoFallback(passos, ligacoes);
  if (f !== null) {
    empurrar("fallback", MODO_ANTIGO ? { portao: null, destino: f } : f);
  }

  return pontos;
}

// ---------------------------------------------------------------------------
// TRÊS VARREDURAS, e a separação entre elas é o que torna o número honesto.
//
// A — A GARANTIA PELA MONTAGEM. Fluxos em que TODA seta que chega no link sai do
//     portão. Aí o link está gateado pelo desenho, e a única forma de alguém
//     recebê-lo sem seguir é o CÓDIGO saltar por cima do portão. Precisa dar
//     ZERO, e herda o papel dos 43.476 casos da Fase 1b.
//
// C — A GARANTIA PELA REGRA, e ela é NOVA desta revisão. Ela existe porque A,
//     sozinha, quase não discrimina, e isso foi medido: com `haCaminho` contando
//     só as setas `sempre` — o erro que um programador de verdade cometeria — A
//     continuava dando ZERO; com `retomadaDoFallback` sem a regra do portão, A
//     continuava dando ZERO. Só o interruptor geral (a regra desligada por
//     completo) a acendia.
//
//     A CAUSA ERA ESTRUTURAL E ESTAVA NO FILTRO. `gateado` exige que toda seta
//     que chega no link saia do portão, então TODO caminho até o link atravessa o
//     portão POR CONSTRUÇÃO DO FILTRO — a propriedade que A mede é garantida pelo
//     recorte, não pelo código. E pior: a seta de botão que SALTA o portão, que é
//     o defeito que abriu esta tarefa, é excluída de A por construção (ela chega
//     no link sem sair do portão, então o fluxo cai em B).
//
//     C recorta o oposto: SALTOS de fluxos NÃO gateados cujo DESTINO está a
//     jusante do portão (`alcança(G, destino)`). Aí não há filtro nenhum
//     protegendo o link — quem tem que barrar a pessoa é a REGRA, marcando o
//     portão na `Retomada`. C precisa dar ZERO, e um zero em C significa alguma
//     coisa: é o código, e só ele, que o produz.
//
//     O GATILHO FICA DE FORA DE C, e a exclusão é medida, não conveniência: o
//     porquê inteiro está em `pontosDeEntrada`, junto com o caso que a decidiu.
//
//     `alcanca` daqui é um BFS INDEPENDENTE, escrito neste arquivo justamente
//     para não perguntar ao réu se o crime aconteceu. É por isso que o plantio
//     do `haCaminho` aparece: `alcanca` continua vendo a seta de botão que o
//     `haCaminho` plantado deixou de ver, então C classifica o ponto como
//     "a regra tem que fechar" e mede o link saindo.
//
// B — A FALHA FECHADA. O resto dos fluxos não gateados: saltos cujo destino o
//     portão NÃO alcança, mais o gatilho. Aqui a montagem já abriu a porta e
//     nenhum código pode fechá-la — se o portão não está a montante do destino, a
//     regra do caminho não tem o que marcar. Não precisa ser zero; precisa ser
//     MENOR do que o do código antigo. Quem fecha o resto é a conferência do
//     editor, recusando a seta.
//
// A UNIDADE DOS TRÊS É O SALTO, e não o ponto de entrada. O porquê está em
// `executar`, com as duas medições que o decidiram.
// ---------------------------------------------------------------------------
let casosA = 0;
let vazamentosA = 0;
let pontosA = 0;
let casosC = 0;
let vazamentosC = 0;
let pontosC = 0;
let casosB = 0;
let vazamentosB = 0;
let pontosB = 0;
let descartadas = 0;
const exemplos = [];

// A identidade do bloco de destino de uma `Retomada`, nos dois modos: no modo
// ANTIGO `destino` é um ÍNDICE, no atual já é identidade.
function idDoDestino(passos, retomada) {
  const d = retomada.destino;
  if (d === null || d === undefined) return null;
  return typeof d === "number" ? S.identidadeNoIndice(passos, d) : d;
}

// A REGRA TEM QUE FECHAR ESTE SALTO? Três coisas ao mesmo tempo:
//
//   - o salto é uma RETOMADA, não o gatilho (`regraSeAplica`, acima);
//   - o portão está A MONTANTE do destino, que é a pergunta que a regra faz;
//   - o destino não é o PRÓPRIO portão — aí quem segura é `interpretar`, que
//     para nele sozinha, e não a regra.
function fechaPelaRegra(passos, ligacoes, retomada, regraSeAplica) {
  const destino = idDoDestino(passos, retomada);
  return regraSeAplica && destino !== null && destino !== ID.G && alcanca(ligacoes, ID.G, destino);
}

function medir(passos, ligacoes, arranjo, gateado) {
  const conta = { nA: 0, vA: 0, nC: 0, vC: 0, nB: 0, vB: 0 };

  for (const { nome, retomada, regraSeAplica } of pontosDeEntrada(passos, ligacoes)) {
    const medidas = [];
    executar(passos, ligacoes, retomada, regraSeAplica, gateado, medidas, 0, nome);

    for (const m of medidas) {
      conta[`n${m.grupo}`]++;
      if (!m.vazou) continue;
      conta[`v${m.grupo}`]++;
      if (m.grupo !== "B" && exemplos.length < 4) {
        exemplos.push({
          grupo: m.grupo,
          arranjo: arranjo.join(""),
          // O SALTO QUE VAZOU, não o ponto de entrada da recursão: nas chamadas
          // internas (o ramo `pedir_email`, em `executar`) os dois divergem, e
          // imprimir o ponto de entrada aqui já produziu, na tela, "exemplo de
          // vazamento em C / ponto: gatilho" para um vazamento que na verdade
          // aconteceu no salto interno do e-mail já conhecido — contradizendo
          // "o gatilho fica de fora de C", documentado acima.
          ponto: m.rotulo,
          retomada: m.retomada,
          ligacoes: ligacoes.map(
            (l) =>
              `${l.de} -${l.quando.tipo === "botao" ? l.quando.botao : l.quando.tipo}-> ${l.para}`
          ),
        });
      }
    }
  }
  return conta;
}

for (const ligacoes of topologias()) {
  // O PORTÃO PRECISA PODER PROTEGER O LINK. Sem caminho do portão até o link,
  // não há portão no caminho de ninguém e não há garantia a verificar — é fluxo
  // em que o dono não pôs portão nenhum na frente do link.
  if (!alcanca(ligacoes, ID.G, ID.L)) {
    descartadas++;
    continue;
  }
  // TODA SETA QUE CHEGA NO LINK SAI DO PORTÃO? Todo caminho até o link termina
  // numa seta que chega nele; se todas saem do portão, todo caminho passou por
  // ele. É a definição de "link gateado pela montagem", e é o que separa A de
  // C+B.
  const gateado = ligacoes.every((l) => l.para !== ID.L || l.de === ID.G);

  for (const arranjo of ARRANJOS) {
    const passos = arranjo.map((p) => BLOCOS[p]);
    const entrada = passos[0].id;
    // Caso VAZIO não prova nada: se o link não é alcançável a partir da entrada,
    // nenhum fluxo normal chega nele e a medição não diz nada sobre o portão.
    if (entrada === ID.L || !alcanca(ligacoes, entrada, ID.L)) {
      descartadas++;
      continue;
    }

    const c = medir(passos, ligacoes, arranjo, gateado);
    casosA += c.nA > 0 ? 1 : 0;
    pontosA += c.nA;
    vazamentosA += c.vA;
    casosC += c.nC > 0 ? 1 : 0;
    pontosC += c.nC;
    vazamentosC += c.vC;
    casosB += c.nB > 0 ? 1 : 0;
    pontosB += c.nB;
    vazamentosB += c.vB;
  }
}

console.log(`modo:   ${MODO_ANTIGO ? "ANTIGO (contraprova)" : "ATUAL"}`);
console.log(`steps:  ${CAMINHO_STEPS}`);
console.log("");
console.log("A — A GARANTIA PELA MONTAGEM (toda seta que chega no link sai do portão)");
console.log(`  casos (fluxo + ordem do array): ${casosA}`);
console.log(`  saltos medidos (entrada + dentro):  ${pontosA}`);
console.log(`  VAZAMENTOS:                     ${vazamentosA}`);
console.log("");
console.log("C — A GARANTIA PELA REGRA (link aberto pela montagem, portão a montante do destino)");
console.log(`  casos (fluxo + ordem do array): ${casosC}`);
console.log(`  saltos medidos (entrada + dentro):  ${pontosC}`);
console.log(`  VAZAMENTOS:                     ${vazamentosC}`);
console.log("");
console.log("B — A FALHA FECHADA (portão não alcança o destino: nenhum código fecha)");
console.log(`  casos:                          ${casosB}`);
console.log(`  saltos medidos (entrada + dentro):  ${pontosB}`);
console.log(`  entregas sem portão:            ${vazamentosB}`);
console.log("");
console.log(`descartados (portão não alcança o link, ou o link não é alcançável): ${descartadas}`);
for (const e of exemplos) {
  console.log(`\n  exemplo de vazamento em ${e.grupo}`);
  console.log(`    arranjo:  ${e.arranjo}`);
  console.log(`    ponto:    ${e.ponto}`);
  console.log(`    retomada: ${JSON.stringify(e.retomada)}`);
  for (const l of e.ligacoes) console.log(`    seta:     ${l}`);
}

// O CÓDIGO DE SAÍDA OLHA A E C, e olhar só A era o defeito que a revisão pegou:
// o plantio do `haCaminho` levou B de 714.908 para 2.045.528 e a varredura saía
// com código 0, porque A não o via. ESSES DOIS NÚMEROS SÃO HISTÓRICOS — da
// classificação ANTIGA, por ponto de entrada. Na classificação atual, por
// SALTO (ver "A UNIDADE DOS TRÊS É O SALTO" acima), o mesmo plantio deixa B em
// 261.536 — o número do cabeçalho no topo do arquivo, não este. A e C juntas
// veem os QUATRO plantios medidos lá em cima: `haCaminho` só com `sempre`,
// `retomadaDoFallback` sem a regra, `retomadaDoEmailConhecido` sem a regra, e a
// regra desligada por completo.
//
// B FICA DE FORA do código de saída de propósito. Ele não tem valor-alvo: é o
// tamanho da falha que a MONTAGEM abre e que nenhum código fecha, e prendê-lo a
// um número fixo aqui só criaria um limiar para alguém ajustar quando ele
// mudasse por motivo legítimo. O número de B é para ser LIDO, ao lado do da
// contraprova, não para passar num portão.
console.log("");
if (MODO_ANTIGO) {
  const acusou = vazamentosA > 0 && vazamentosC > 0;
  console.log(
    acusou
      ? "CONTRAPROVA OK: o código antigo vaza em A e em C."
      : "CONTRAPROVA MUDA: a varredura não discrimina — um zero aqui não prova nada."
  );
  process.exitCode = acusou ? 0 : 1;
} else {
  const limpo = vazamentosA === 0 && vazamentosC === 0;
  console.log(limpo ? "SEM VAZAMENTO em A nem em C." : "VAZOU.");
  process.exitCode = limpo ? 0 : 1;
}
