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
//   node scripts/varredura-portao.mjs
//   node scripts/varredura-portao.mjs --antigo <caminho/para/steps-antigo.ts>
//
// O segundo é a CONTRAPROVA, e ela não é formalidade: uma varredura que dá zero
// vazamentos e zero na contraprova não provou nada — provou que não mede. O
// modo `--antigo` carrega o lib/steps.ts de ANTES da Tarefa 3b (o arquivo de
// verdade, tirado do git, e não uma reimplementação) e reproduz a cola do motor
// daquele commit. Ele TEM que acusar.
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

function executar(passos, ligacoes, retomada, entregues, profundidade = 0) {
  if (profundidade > TETO_RECURSAO) return;

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
      const seguinte = MODO_ANTIGO
        ? acao.indice + 1
        : S.seguinteDe(ligacoes, S.identidadeDoPasso(p, acao.indice));
      executar(passos, ligacoes, { portao: null, destino: seguinte }, entregues, profundidade + 1);
      return;
    }
    entregues.push(p);
  }
}

// Todo ponto por onde alguém volta a um fluxo, do jeito que lib/engine.ts os
// monta. É a lista que a Tarefa 3b converteu, e por isso ela é a lista que
// precisa ser varrida.
function pontosDeEntrada(passos, ligacoes) {
  const pontos = [];
  const empurrar = (nome, retomada) => retomada && pontos.push({ nome, retomada });
  const entrada = MODO_ANTIGO ? 0 : S.identidadeNoIndice(passos, 0);

  // O gatilho: palavra-chave, comentário, resposta de story.
  empurrar("gatilho", { portao: null, destino: entrada });

  // Todo toque em todo botão. Um botão entregue vive na conversa da pessoa
  // indefinidamente, então todos são tocáveis a qualquer momento.
  for (const l of ligacoes) {
    if (l.quando.tipo !== "botao") continue;
    const p = S.lerPayload(`AUTO:A:${l.de}:${l.quando.botao}`);
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
// DUAS VARREDURAS, e a separação entre elas é o que torna o número honesto.
//
// A — A GARANTIA. Fluxos em que TODA seta que chega no link sai do portão. Aí o
//     link está gateado pela montagem, e a única forma de alguém recebê-lo sem
//     seguir é o CÓDIGO saltar por cima do portão. É a varredura que precisa dar
//     ZERO, e é a que herda o papel dos 43.476 casos da Fase 1b.
//
// B — A FALHA FECHADA. Fluxos em que o dono desenhou uma seta que chega no link
//     SEM vir do portão — o caso medido que abriu esta tarefa, com a seta de um
//     botão saltando o portão. Aqui a montagem já abriu a porta, e nenhum código
//     pode fechá-la por inteiro: se o portão não alcança o destino de ninguém, a
//     regra do caminho não tem o que marcar. O que a regra faz é fechar todo
//     salto em que o portão ESTÁ no caminho, e o número de B mede exatamente
//     isso — ele não precisa ser zero, precisa ser MENOR do que o do código
//     antigo. Quem fecha o resto é a conferência do editor, recusando a seta.
// ---------------------------------------------------------------------------
let casosA = 0;
let vazamentosA = 0;
let pontosA = 0;
let casosB = 0;
let vazamentosB = 0;
let pontosB = 0;
let descartadas = 0;
const exemplos = [];

function medir(passos, ligacoes, arranjo, registrarExemplo) {
  let n = 0;
  let vaz = 0;
  for (const { nome, retomada } of pontosDeEntrada(passos, ligacoes)) {
    n++;
    const entregues = [];
    executar(passos, ligacoes, retomada, entregues);
    if (!entregues.some((p) => p.tipo === "dm" && p.url)) continue;
    vaz++;
    if (registrarExemplo && exemplos.length < 4) {
      exemplos.push({
        arranjo: arranjo.join(""),
        ponto: nome,
        retomada,
        ligacoes: ligacoes.map(
          (l) => `${l.de} -${l.quando.tipo === "botao" ? l.quando.botao : l.quando.tipo}-> ${l.para}`
        ),
      });
    }
  }
  return [n, vaz];
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
  // ele. É a definição de "link gateado pela montagem", e é o que separa A de B.
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

    const [n, vaz] = medir(passos, ligacoes, arranjo, gateado);
    if (gateado) {
      casosA++;
      pontosA += n;
      vazamentosA += vaz;
    } else {
      casosB++;
      pontosB += n;
      vazamentosB += vaz;
    }
  }
}

console.log(`modo:   ${MODO_ANTIGO ? "ANTIGO (contraprova)" : "ATUAL"}`);
console.log(`steps:  ${CAMINHO_STEPS}`);
console.log("");
console.log("A — A GARANTIA (link gateado pela montagem: toda seta que chega nele sai do portão)");
console.log(`  casos (fluxo + ordem do array): ${casosA}`);
console.log(`  pontos de entrada medidos:      ${pontosA}`);
console.log(`  VAZAMENTOS:                     ${vazamentosA}`);
console.log("");
console.log("B — A FALHA FECHADA (o dono desenhou uma seta que chega no link sem vir do portão)");
console.log(`  casos:                          ${casosB}`);
console.log(`  pontos de entrada medidos:      ${pontosB}`);
console.log(`  entregas sem portão:            ${vazamentosB}`);
console.log("");
console.log(`descartados (portão não alcança o link, ou o link não é alcançável): ${descartadas}`);
for (const e of exemplos) {
  console.log(`\n  exemplo de vazamento em A`);
  console.log(`    arranjo:  ${e.arranjo}`);
  console.log(`    ponto:    ${e.ponto}`);
  console.log(`    retomada: ${JSON.stringify(e.retomada)}`);
  for (const l of e.ligacoes) console.log(`    seta:     ${l}`);
}
process.exitCode = MODO_ANTIGO ? (vazamentosA > 0 ? 0 : 1) : vazamentosA > 0 ? 1 : 0;
