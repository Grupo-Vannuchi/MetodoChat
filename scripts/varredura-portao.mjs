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
// SÃO DUAS VARREDURAS, e a segunda nasceu na Tarefa 7c. As duas fazem a MESMA
// pergunta, com o MESMO medidor (`medir`, `pontosDeEntrada`, `executar`); o que
// muda é o espaço de fluxos que cada uma percorre:
//
//   A EXAUSTIVA — cinco papéis (E, G, L, M, P), setas `sempre` e `botao`. É a
//     varredura que já existia, e ela está aqui BYTE POR BYTE: os números dela
//     não mudaram com esta tarefa, e é por isso que a tabela de plantios abaixo
//     continua valendo sem ser refeita.
//   A DO MENU E DA `senao` — cinco papéis com o MENU no lugar da resposta
//     rápida (N, G, L, M, P), mais UMA seta `senao`. É o espaço dos dois
//     recursos mais novos da fase, e antes desta tarefa NENHUMA das duas o
//     tocava.
//
// POR QUE DUAS, e não uma só maior: o espaço de SEIS papéis com `senao` não é
// enumerável. Contado, com seis papéis cada saída passa a ter 6 destinos
// possíveis em vez de 5, e o produto cartesiano das dez saídas mais o eixo da
// `senao` dá 6·5·5·6·6·6·6·6·6·5·31 = 1.084.752.000 topologias — contra as
// 250.000 da exaustiva. Não é uma constante a ajustar; são quatro ordens de
// grandeza. Então o corte foi pelo lado do PAPEL: a segunda varredura troca a
// `dm` de resposta rápida pelo MENU, em vez de somar um sexto bloco.
//
// E A TROCA GANHA MAIS DO QUE ECONOMIA DE TEMPO, o que só apareceu ao medir:
// `retomadaDoFallback` devolve null quando o fluxo tem mais de UMA parada dura
// (`contarParadasDuras`, lib/steps.ts), e tanto a resposta rápida quanto o menu
// são paradas duras. Com E **e** N na mesma lista o fallback seria null em todo
// caso, e a segunda varredura perderia um dos seis pontos de retomada em
// silêncio. Com a troca, o menu é a única parada dura da lista e o fallback
// continua vivo.
//
// ELA ESTÁ NO `npm run verify`, e a decisão tem número: as duas varreduras
// juntas levam ~65 segundos (duas rodadas medidas: 65 e 66, depois da Tarefa
// 7c-débito devolver os dez arranjos à do menu), contra os minutos do
// `next build` que o `verify` já roda. Não vale a pena montar um modo de amostra
// para o `verify` e guardar a completa para "sob demanda": amostra é um segundo
// número para manter, e "sob
// demanda" é o mesmo que não rodar. Uma prova que ninguém roda não protege nada,
// e esta é a única prova que o produto tem da promessa central.
//
// O CORTE DOS ARRANJOS FOI TENTADO NAS DUAS VARREDURAS, E RECUSADO NAS DUAS. Na
// exaustiva, cortar para as cinco ROTAÇÕES derruba a contraprova — medido na
// revisão da Tarefa 7c. Na do menu, o corte chegou a ficar no arquivo por uma
// tarefa inteira, e caiu quando a contraprova passou a cobrar A dela também:
// cortada, ela não acusa (A 0 contra o mesmo commit); com os dez arranjos,
// acusa (A 112.380). O eixo dos arranjos é redundante para o código de HOJE —
// dobrar de cinco para dez dobra cada contador sem mudar nenhum deles — mas é o
// instrumento inteiro da contraprova para o de ONTEM, porque aquele código é
// POSICIONAL. A medição dos dois lados está em `arranjosDe`, lá embaixo, e é ela
// que fixa a fronteira. Sortear topologias segue fora de questão.
//
// AS DUAS SÃO EXAUSTIVAS SOBRE AS TOPOLOGIAS que declaram, e é isso que separa
// esta prova de uma amostra. Não sobre a ORDEM do array, e essa ressalva está na
// lista do que elas não cobrem — um corte não declarado é uma amostra que se
// chama de exaustiva.
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
// acusar — em A e em C, NAS DUAS VARREDURAS —, e sai com código 1 se não
// acusar. Medido, em 120 a 121 s: exaustiva A 76.020 e C 3.366.888 (B 849.150);
// do menu A 112.380 e C 4.576.743 (B 1.974.317).
//
// OS PLANTIOS que esta varredura precisa acusar, e os números medidos — eles são
// o critério de que ela DISCRIMINA, e não um enfeite. Refazê-los é o teste do
// teste, e quem mexer aqui deve refazê-los.
//
// NA EXAUSTIVA (os quatro da revisão da Tarefa 4, inalterados por esta tarefa):
//
//   `haCaminho` contando só setas `sempre`      A: 0        C:  2.713.648
//   `retomadaDoFallback` sem a regra             A: 0        C:     91.200
//   `retomadaDoEmailConhecido` sem a regra       A: 0        C:  1.102.772
//   a regra do portão desligada por completo     A: 73.720   C: 15.091.792
//
// NA DO MENU E DA `senao` (os três da Tarefa 7c). ATENÇÃO: os TRÊS deixam a
// EXAUSTIVA byte a byte idêntica à linha de base — foi essa cegueira que abriu a
// tarefa, e ela foi medida com os três plantios antes de esta segunda varredura
// existir. PENDÊNCIA DA TAREFA 7c-DÉBITO: os números abaixo, e os da LINHA DE
// BASE do menu logo adiante, foram medidos com os cinco arranjos (as
// ROTAÇÕES) que a Tarefa 7c tinha cortado. A Tarefa 7c-débito devolveu os dez
// arranjos (`ARRANJOS_DO_MENU`, acima de `arranjosDe`) e a base do menu mudou —
// medido, A e C do menu dobram (ver o parágrafo "A DO MENU MEDE O MESMO" perto
// de `arranjosDe`) — mas replantar estes três defeitos exige mexer em
// lib/steps.ts, fora do escopo desta tarefa. Estes números ficam desatualizados
// até alguém replantá-los:
//
//   destino da `senao` sem `atravessandoOPortao`   A: 0   C: 199.452
//   toque em botão de MENU sem a regra do portão   A: 0   C: 178.450
//   `retomadaDoTexto` voltando a ignorar a `senao` -> a GUARDA DA FIAÇÃO estoura
//
// O TERCEIRO NÃO É MEDIDO POR NÚMERO, e a razão está na guarda logo abaixo de
// `BLOCOS`: ignorar a `senao` não entrega link nenhum a mais — ela some do
// caminho, e quem digitava num menu volta a não receber nada. Medido com a
// guarda desligada, as duas varreduras dão A 0 e C 0 e o processo sai com CÓDIGO
// 0, imprimindo "SEM VAZAMENTO": a exaustiva fica byte a byte igual à linha de
// base (B 261.536), e na do menu só as contagens se mexem — saltos de A
// 1.484.984 -> 1.487.274, saltos de C 4.730.958 -> 4.687.646, saltos de B
// 5.605.551 -> 5.655.994 e as entregas de B 125.583 -> 124.843. Ou seja, sem a
// guarda esse plantio PASSARIA — e a segunda varredura estaria percorrendo um
// eixo que o sistema não percorre, imprimindo zero para um espaço que ela não
// mede. É a mesma classe de defeito da reserva silenciosa de `payloadDoBotao`,
// por outra porta.
//
// A LINHA DE BASE das duas, para os números acima terem de que se afastar:
//
//   exaustiva     A  73.720 casos /  2.088.628 saltos / 0    B: 261.536
//                 C 954.160 casos / 11.333.976 saltos / 0
//   do menu       A 118.700 casos /  2.969.968 saltos / 0    B: 251.166
//                 C 867.480 casos /  9.461.916 saltos / 0
//
// Repare que TRÊS DOS QUATRO da exaustiva deixam A em ZERO, e que os dois novos
// também. Foi por isso que C existe: até a revisão da Tarefa 4 a varredura tinha
// só A e B, e A só acusava o interruptor geral — os outros passavam com código
// de saída 0. O porquê está lá embaixo, na separação dos grupos.
//
// E repare que B NÃO SE MEXE em nenhum dos quatro da exaustiva (261.536
// sempre). Isso NÃO é "mudança de código nunca aparece em B" — a revisão plantou
// `seguinteDe` devolvendo a primeira ligação de saída de QUALQUER tipo (mudança
// de código puro, nenhuma REGRA envolvida) e mediu B saltar de 261.536 para
// 321.008, com a varredura saindo em código 0 e imprimindo "SEM VAZAMENTO" —
// contraexemplo medido, não hipotético.
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
//   - Cinco blocos por fluxo, em cada uma das duas varreduras. Fluxos maiores
//     existem; o que estas varreduras afirmam é sobre a forma das ligações, não
//     sobre o tamanho.
//   - A ORDEM DO ARRAY, e este é o único eixo em que "EXAUSTIVA" não vale para
//     nenhuma das duas. São 120 ordens possíveis de cinco blocos, e as duas
//     varreduras percorrem as mesmas 10: as cinco ROTAÇÕES, que garantem "cada
//     papel é a entrada uma vez" — o único significado que a ordem guarda depois
//     do grafo —, e as cinco INVERTIDAS, que existem para o portão cair antes e
//     depois do link no array sem que as ligações mudem. O que elas acrescentam
//     e o que custam está medido em `arranjosDe`, lá embaixo. Nenhuma das duas
//     percorre as outras 110.
//   - UMA `senao` por fluxo, na segunda varredura. Um fluxo com duas — um menu e
//     um portão com a `senao` gravada fora do editor, por exemplo — não é
//     percorrido. A ORIGEM da `senao` varre os cinco papéis, então cada uma das
//     posições perigosas aparece; o que falta é a combinação delas.
//   - A `dm` de RESPOSTA RÁPIDA e o MENU nunca aparecem no mesmo fluxo, que é o
//     outro lado da troca de papel explicada lá em cima.

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
// reproduzir aquele código, não este.
//
// A ESCOLHA É PELO MODO, E NÃO PELO `??`, e essa é a correção da rodada final.
// Com `S.payloadDoBotao ?? (…)`, renomear ou remover o export deixava a
// varredura cair na interpolação à mão SEM UMA PALAVRA — medido: ela imprimia
// "SEM VAZAMENTO" idêntico. Ou seja, ela voltava a medir a própria ideia dela
// de payload, na única ferramenta do projeto cujo trabalho é não ser
// silenciosa. Escrito assim, o modo atual EXIGE a função do sistema e estoura
// se ela não estiver lá, e a cópia à mão só é alcançável onde ela é a resposta
// certa.
const montarAntigo = (automacao, bloco, botao) => `AUTO:${automacao}:${bloco}:${botao}`;
if (!MODO_ANTIGO && typeof S.payloadDoBotao !== "function") {
  throw new Error(
    "lib/steps.ts não exporta `payloadDoBotao`. A varredura mede o payload do SISTEMA; " +
      "sem essa função ela mediria a própria cópia, e isso não é medição. " +
      "Se a função mudou de nome, mude aqui também."
  );
}
const montarPayload = MODO_ANTIGO ? montarAntigo : S.payloadDoBotao;

// ---------------------------------------------------------------------------
// OS BLOCOS. Seis papéis, cinco por varredura, e cada um está aqui por um
// motivo:
//
//   E  a `dm` de resposta rápida — o bloco que emite UM botão e para nele.
//   G  o portão. Um só por fluxo, que é o que `conferirLista` permite.
//   L  o LINK. É o que não pode sair sem o portão; é a pergunta inteira.
//   M  uma `dm` comum, para haver braço sem nada de especial nele.
//   P  o pedido de e-mail, porque o motor tem um ramo que PULA esse bloco
//      (e-mail já conhecido) e esse ramo é um dos seis pontos convertidos.
//   N  o MENU de `botoes`, e ele é a novidade da Tarefa 7c. É o único bloco a
//      que o editor dá a alça do "digitou" (`alcasDeSaida`), e o que mais perde
//      com a cegueira: menu inteiramente ligado NÃO TEM `sempre` saindo, então
//      quem digita nele só tem a `senao` para percorrer.
//
// E e N NUNCA APARECEM JUNTOS: E é a lista da varredura exaustiva, N é a da
// varredura do menu. O porquê está no cabeçalho, junto com a medição do
// fallback que decidiu a troca.
// ---------------------------------------------------------------------------
const BLOCOS = {
  E: { id: "b_ee00001", tipo: "dm", texto: "escolha", botao_label: "quero" },
  G: { id: "b_gg00002", tipo: "pedir_follow", texto: "me segue", botao_label: "Já sigo!" },
  L: { id: "b_ll00003", tipo: "dm", texto: "toma", url: "https://x.y" },
  M: { id: "b_mm00004", tipo: "dm", texto: "um bloco qualquer" },
  P: { id: "b_pp00005", tipo: "pedir_email", texto: "seu e-mail?" },
  N: { id: "b_nn00006", tipo: "dm", texto: "escolha uma", botoes: [{ id: "op_dddddd", rotulo: "a" }] },
};
const PAPEIS = ["E", "G", "L", "M", "P"];
const PAPEIS_MENU = ["N", "G", "L", "M", "P"];
const ID = Object.fromEntries(Object.keys(BLOCOS).map((p) => [p, BLOCOS[p].id]));

// A GUARDA DA FIAÇÃO NOVA, e ela é a mesma ideia da guarda de `payloadDoBotao`
// logo acima, aplicada ao eixo que esta varredura acabou de ganhar.
//
// A segunda varredura desenha `senao` e monta um bloco de MENU. Se o sistema
// deixar de reconhecer qualquer uma dessas duas coisas, essas setas e esse bloco
// viram DECORAÇÃO: a varredura continua rodando, continua levando os seus ~33
// segundos (duas rodadas medidas: 31 e 35, com os dez arranjos da Tarefa
// 7c-débito) e continua imprimindo zero — só que zero sobre um espaço que ela
// não está mais percorrendo. É exatamente a falha da reserva silenciosa que
// este arquivo já levou uma vez, e ela custa mais aqui: lá a varredura media a
// própria ideia dela de payload; aqui ela mediria um eixo inteiro que não
// existe.
//
// AS SEIS PERGUNTAS SÃO DE FIAÇÃO, E NÃO DE PORTÃO, e a diferença é o que
// mantém a guarda honesta: nenhuma delas afirma que o link é barrado — isso é o
// que as varreduras medem, e uma guarda que o afirmasse estaria respondendo pela
// medição. O que elas afirmam é que o caminho que a varredura desenha É um
// caminho que o sistema percorre.
//
// AS DUAS ÚLTIMAS NASCERAM DA REVISÃO DESTA TAREFA, e as duas fecham eixos que
// as quatro primeiras deixavam abertos — as duas medidas, e não supostas. OS
// SALTOS DE A E DE C ABAIXO TÊM A MESMA PENDÊNCIA registrada perto de `BLOCOS`:
// foram medidos contra a base do menu de ANTES da Tarefa 7c-débito (1.484.984 /
// 4.730.958), que dobrou. Replantar os dois exige mexer em `lib/steps.ts`
// (o primeiro) ou reconstruir `PAPEIS_MENU` (o segundo), os dois fora do escopo
// desta tarefa:
//
//   `caminhoDoBotao` É O EIXO DO BOTÃO DE MENU, que carrega uma das duas
//     acusações numéricas desta varredura (o plantio do toque em botão de menu
//     sem a regra do portão, C 178.450). Sem esta pergunta, o eixo morre em
//     silêncio: medido, fazendo `caminhoDoBotao` devolver `{motivo}` para bloco
//     de `botoes`, o ramo `else if (c.retomada)` de `pontosDeEntrada` descarta
//     todo toque sem uma palavra e a varredura imprime "SEM VAZAMENTO em A nem
//     em C, nas duas varreduras" com CÓDIGO 0 — a exaustiva intacta, e na do
//     menu só as contagens se mexendo: saltos de A 1.484.984 -> 1.414.624,
//     saltos de C 4.730.958 -> 4.408.632, entregas de B 125.583 -> 119.568.
//   `retomadaDoFallback` É A TROCA DE PAPEL, e é a medição do cabeçalho virada
//     em pergunta. Ela devolve null quando o fluxo tem mais de UMA parada dura
//     (`contarParadasDuras`), e `pontosDeEntrada` só empurra o fallback quando
//     ela não é null — então acrescentar um segundo bloco de parada dura a
//     `PAPEIS_MENU` apaga um ponto de medição inteiro sem erro nenhum. Medido,
//     tirando só esse ponto da varredura do menu: saltos de A 1.484.984 ->
//     1.415.894, saltos de C 4.730.958 -> 4.532.252, entregas de B 125.583 ->
//     123.371. Meio milhão de saltos que sumiriam calados.
//
// FICA FORA DO MODO ANTIGO porque o commit da contraprova é anterior às duas
// coisas: lá `envioDaDm` não conhece `botoes` e `retomadaDoTexto` nem recebe
// ligações. A segunda varredura roda igual naquele modo — o menu vira uma `dm` de
// texto e a `senao` vira seta que ninguém segue —, e é assim que ela tem que
// rodar: o modo antigo reproduz o commit, não este.
if (!MODO_ANTIGO) {
  const reclamar = (o_que) => {
    throw new Error(
      `${o_que} A varredura do menu e da \`senao\` desenha esse caminho em todos os fluxos que ` +
        "percorre; sem ele, ela varre um eixo que o sistema não percorre e imprime zero para um " +
        "espaço que não está medindo. Conserte o sistema, ou mude esta varredura junto."
    );
  };
  if (S.envioDaDm(BLOCOS.N).forma !== "botoes") {
    reclamar("`envioDaDm` não reconhece mais um bloco de `botoes` como MENU.");
  }
  if (S.esperaResposta(BLOCOS.N) !== true) {
    reclamar("`esperaResposta` não para mais num MENU.");
  }
  const setaSenao = { de: ID.N, quando: { tipo: "senao" }, para: ID.M };
  if (!S.conferirLigacao(setaSenao).ligacao) {
    reclamar("`conferirLigacao` não aceita mais uma ligação `senao`.");
  }
  if (S.retomadaDoTexto([BLOCOS.N, BLOCOS.M], [setaSenao], 0).destino !== ID.M) {
    reclamar("`retomadaDoTexto` não segue mais a `senao` de quem digitou num menu.");
  }
  const setaBotao = { de: ID.N, quando: { tipo: "botao", botao: "op_dddddd" }, para: ID.M };
  const doBotao = S.caminhoDoBotao(
    S.lerPayload(montarPayload("A", ID.N, "op_dddddd")),
    [BLOCOS.N, BLOCOS.M],
    [setaBotao]
  );
  if (!doBotao?.retomada) {
    reclamar("`caminhoDoBotao` não retoma mais de um toque em botão de MENU.");
  }
  // SEM LIGAÇÃO NENHUMA, de propósito: o que se pergunta aqui é se a LISTA tem
  // uma parada dura só — é `contarParadasDuras` que decide o null, e ele olha os
  // blocos, não as setas. Com a lista do menu a resposta é uma `Retomada` (de
  // destino nulo, que é o que se espera sem setas); pondo E e N na mesma lista,
  // medido, ela vira null e o ponto do fallback some.
  if (S.retomadaDoFallback(PAPEIS_MENU.map((p) => BLOCOS[p]), []) === null) {
    reclamar("`retomadaDoFallback` não devolve mais retomada para a lista da varredura do menu.");
  }
}

// Alcançabilidade escrita AQUI, e não importada de lib/steps.ts, de propósito:
// se a varredura usasse `haCaminho` para decidir quais fluxos medir, ela estaria
// perguntando ao réu se o crime aconteceu. Este BFS é independente e serve só
// para escolher os casos.
//
// `sem` NÃO TEM CHAMADOR NESTE ARQUIVO, e fica assim de propósito: ele é a
// contraparte declarada do `evitar` de `haCaminho` (lib/steps.ts), que o nomeia
// por escrito em dois lugares — "é o mesmo parâmetro que o BFS independente da
// varredura já tem com o nome `sem`". Apagá-lo apodreceria as duas referências
// sem devolver nada. O que ele NÃO é: um caminho exercitado — nenhuma das duas
// varreduras o usa, então ele não está coberto por medição nenhuma daqui.
//
// (Havia um segundo parâmetro morto, `so_sempre`, e esse saiu: ele não era
// contraparte de nada, e a pergunta que respondia — "e se só as `sempre`
// contassem?" — é justamente um dos plantios da tabela lá em cima, feito no
// `haCaminho` do sistema, que é onde ele mede alguma coisa.)
function alcanca(ligacoes, de, para, sem = null) {
  const vistos = new Set([de]);
  const fila = [de];
  while (fila.length) {
    const atual = fila.shift();
    for (const l of ligacoes) {
      if (l.de !== atual) continue;
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
// OS FLUXOS DA VARREDURA EXAUSTIVA. As setas são geradas por produto cartesiano
// sobre cada saída:
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

// ---------------------------------------------------------------------------
// OS FLUXOS DA VARREDURA DO MENU E DA `senao` (Tarefa 7c). Mesmo formato, e as
// diferenças são três:
//
//   O MENU N ENTRA NO LUGAR DE E. Ele tem um botão (`op_dddddd`, o mesmo que
//     `BLOCOS.N` declara) e uma `sempre` opcional — que num menu é a seta ÓRFÃ,
//     o caso que `retomadaDoTexto` registra como produzível pela tela: uma `dm`
//     de resposta rápida com seta já desenhada ganha `botoes` e vira menu, e
//     NADA apaga a `sempre` dela. É o caso que decide a precedência entre as
//     duas, então ele precisa estar no espaço.
//   M PERDE O BOTÃO. A bifurcação num braço já está coberta pela exaustiva, e
//     este eixo é o que paga o eixo da `senao` sem estourar o tempo: com ele, o
//     espaço seria 1,3 milhão de topologias em vez de 262.500.
//   ENTRA UMA `senao`, e a ORIGEM dela varre os cinco papéis — não só o menu.
//     O editor só desenha a alça do "digitou" num menu, mas ligação gravada FORA
//     do painel chega em qualquer bloco, e é justamente a `senao` gravada num
//     `pedir_follow` que `retomadaDoTexto` recusa por escrito ("bastaria mandar
//     'ok' para receber o link sem seguir"). Uma varredura que só desenhasse a
//     `senao` no menu não teria como acusar quem apagar aquela recusa.
//
// UMA `senao` POR FLUXO, e a limitação está declarada no cabeçalho. São 21
// valores para este eixo — nenhuma, ou uma de cada papel para cada outro.
// ---------------------------------------------------------------------------
function* topologiasDoMenu() {
  const outros = (p) => PAPEIS_MENU.filter((q) => q !== p);
  const comNada = (ps) => [null, ...ps];
  const senaos = [null];
  for (const de of PAPEIS_MENU) for (const para of outros(de)) senaos.push([de, para]);
  for (const nSempre of comNada(outros("N")))
    for (const nBotao of outros("N"))
      for (const gSempre of comNada(outros("G")))
        for (const lSempre of comNada(outros("L")))
          for (const mSempre of comNada(outros("M")))
            for (const pSempre of comNada(outros("P")))
              for (const senao of senaos) {
                const ls = [];
                const liga = (de, quando, para) =>
                  para && ls.push({ de: ID[de], quando, para: ID[para] });
                liga("N", { tipo: "sempre" }, nSempre);
                liga("N", { tipo: "botao", botao: "op_dddddd" }, nBotao);
                liga("G", { tipo: "sempre" }, gSempre);
                liga("L", { tipo: "sempre" }, lSempre);
                liga("M", { tipo: "sempre" }, mSempre);
                liga("P", { tipo: "sempre" }, pSempre);
                if (senao) liga(senao[0], { tipo: "senao" }, senao[1]);
                yield ls;
              }
}

// As ordens de array medidas. Rotações cobrem "cada papel é a entrada uma vez";
// a invertida existe para o portão cair antes e depois do link no array sem que
// as ligações mudem — é a diferença entre "está antes na lista" e "está no
// caminho", que é a troca inteira da Tarefa 3b.
function arranjosDe(papeis) {
  const a = [];
  for (let r = 0; r < papeis.length; r++) {
    a.push(papeis.map((_, i) => papeis[(i + r) % papeis.length]));
    a.push(papeis.map((_, i) => papeis[(papeis.length - 1 - i + r) % papeis.length]));
  }
  return a;
}
// AS DUAS VARREDURAS ANDAM COM OS DEZ ARRANJOS, e isso não é o ponto de
// partida: é o que sobrou depois de duas tentativas de cortar caírem no mesmo
// lugar. Quem for tentar cortar aqui de novo precisa ler os dois blocos abaixo
// antes.
//
// PARA O CÓDIGO DE HOJE OS INVERTIDOS SÃO DUPLICATA LITERAL. Medido, rodando a
// exaustiva com os dez e com as cinco rotações: TODO contador dá exatamente o
// dobro, e todo número plantado que este arquivo cita também.
//
//                                        dez arranjos          cinco
//   A  casos / saltos                  73.720 / 2.088.628   36.860 / 1.044.314
//   C  casos / saltos                 954.160 / 11.333.976 477.080 / 5.666.988
//   B  saltos / entregas           13.271.180 / 261.536  6.635.590 / 130.768
//   plantio do `haCaminho`                C 2.713.648      C 1.356.824
//   plantio do `retomadaDoFallback`       C 91.200         C 45.600
//   plantio do `retomadaDoEmailConhecido` C 1.102.772      C 551.386
//   plantio do interruptor geral   A 73.720 C 15.091.792   A 36.860 C 7.545.896
//   plantio do `seguinteDe`               B 321.008        B 160.504
//   "marcar a execução inteira"           32.040           16.020
//
// (`descartadas` é o único que não cai pela metade, 460.070 -> 286.260, e não é
// exceção: parte dele é contada UMA VEZ por topologia, fora do laço dos
// arranjos, em `varrer`.)
//
// A DO MENU MEDE O MESMO, e é medição da Tarefa 7c-débito: rodando com os dez
// arranjos e só com as cinco rotações, A vai de 118.700 para 59.350 casos
// (2.969.968 -> 1.484.984 saltos) e C de 867.480 para 433.740 casos (9.461.916
// -> 4.730.958 saltos) — os dois com ZERO vazamentos dos dois lados, e B
// (saltos e entregas) também cai exatamente pela metade. Dobro exato nas duas
// varreduras, sem exceção.
//
// E MESMO ASSIM O CORTE NÃO PODE SER FEITO EM NENHUMA DAS DUAS, porque o
// `--antigo` não roda o código de hoje. Ele roda um código POSICIONAL, e ali a
// ordem do array é a regra inteira — é exatamente a troca que a Tarefa 3b fez.
// Medido, a mesma contraprova sobre o mesmo commit:
//
//   exaustiva com os dez arranjos    A  76.020  C 3.366.888   B   849.150 -> OK
//   exaustiva só com as rotações     A       0  C   514.298   B    70.830 -> MUDA
//   exaustiva só com as invertidas   A  76.020  C 2.852.590   B   778.320
//   do menu com os dez arranjos      A 112.380  C 4.576.743   B 1.974.317 -> OK
//   do menu só com as rotações       A       0  C 1.530.346   B   882.060 -> MUDA
//
// OS VAZAMENTOS EM A DA CONTRAPROVA VÊM TODOS DAS INVERTIDAS, nas duas
// varreduras, e as rotações contribuem ZERO. Cortar as invertidas leva a
// contraprova a "CONTRAPROVA MUDA" e o processo a sair com código 1. Foi
// exatamente o que aconteceu com a do menu, por uma tarefa inteira: cortada
// para as cinco rotações, ela media A 0 contra o commit antigo, e o critério de
// saída só cobria C nela — cobrindo A também, ela teria acusado o próprio
// corte.
//
// E A CAUSA É VERIFICÁVEL SEM RODAR NADA, o que é o que separa isto de
// coincidência. Um vazamento em A exige que o LINK esteja ANTES do portão no
// array (é assim que o código posicional salta o portão), e exige que o caso não
// seja descartado. Das cinco rotações, a ÚNICA com L antes de G é `LMPEG` na
// exaustiva (`LMPNG` na do menu) — e ela tem L como entrada, então `varrer` a
// descarta sempre ("caso vazio não prova nada"). Ou seja: as rotações NUNCA
// medem um fluxo com o link antes do portão, em nenhuma das duas varreduras.
// Das cinco invertidas, as que medem são as mesmas três posições relativas em
// cada uma — `PMLGE`, `EPMLG` e `MLGEP` na exaustiva; `PMLGN`, `NPMLG` e
// `MLGNP` na do menu.
const ARRANJOS = arranjosDe(PAPEIS);
const ARRANJOS_DO_MENU = arranjosDe(PAPEIS_MENU);

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
//     Desfazer a correção do e-mail já conhecido — o defeito central da Tarefa
//     3b — deixava A e C em ZERO e só engordava B (261.536 -> 714.908): o
//     vazamento acontecia no salto, e o grupo era decidido pela entrada.
//   MARCAR A EXECUÇÃO INTEIRA se QUALQUER salto dela for do grupo C acusa
//     vazamento no lugar errado, e mede 32.040 deles com o código CERTO. O caso:
//     `M -sempre-> LINK -sempre-> P(e-mail)`. O link sai na entrada, que é do
//     grupo B; o salto do e-mail vem DEPOIS e é do grupo C. A regra não tinha
//     como impedir o que já havia saído antes dela existir.
//
// É TAMBÉM O VIÉS QUE A AMOSTRA DA TAREFA 7b TINHA e que esta varredura não
// herda: aquela amostra devolvia um BOOLEANO por salto externo e atribuía o
// vazamento ao grupo do salto de FORA, então um vazamento no salto interno do
// e-mail já conhecido caía no grupo do salto de texto que o continha. Aqui cada
// salto grava a SUA medida, e é por isso que a incorporação da Tarefa 7c não
// copiou o `executar` de lá: copiou o espaço de fluxos, e mediu com este.
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
      // ESTE É O SEXTO PONTO, e a correção dos achados da revisão da Tarefa 4
      // está nesta linha: no modo ATUAL ele passa por `retomadaDoEmailConhecido`,
      // que devolve uma `Retomada` COM a regra do portão. Antes ele montava
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
  //
  // E É POR AQUI QUE O TOQUE NUM BOTÃO DE MENU ENTRA, desde a Tarefa 7c: a
  // varredura do menu desenha `op_dddddd` saindo de N, e este laço o percorre
  // pelo mesmo caminho de qualquer outro botão. Nada foi acrescentado aqui — o
  // que faltava era um menu no espaço de fluxos.
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
  //
  // O BLOCO DO CURSOR DE OUTRA AUTOMAÇÃO SAI DE `passos`, e não de um papel
  // fixo: escrito `ID.E`, como estava, a varredura DO MENU citava um bloco que
  // não está no fluxo dela (E é da lista da exaustiva). Não muda o que é medido
  // — `cursorDesta` devolve null para automação que não bate, então o `passoId`
  // é inerte neste ponto —, mas um ponto de entrada que nomeia bloco de fora da
  // lista é a espécie de detalhe que faz alguém procurar defeito onde não há.
  const cursores = [
    { passoId: null, automationId: null },
    { passoId: passos[0].id, automationId: "B" }, // cursor de OUTRA automação
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
  // Toda mensagem de texto de quem está parado em cada bloco. É por AQUI que a
  // seta do "digitou" entra: `retomadaDoTexto` é a única função de produção que
  // consulta a `senao`, e ela é consultada uma vez por bloco parado.
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
// TRÊS GRUPOS, e a separação entre eles é o que torna o número honesto. Eles são
// os mesmos nas duas varreduras, e é por isso que as duas cabem no mesmo medidor.
//
// A — A GARANTIA PELA MONTAGEM. Fluxos em que TODA seta que chega no link sai do
//     portão. Aí o link está gateado pelo desenho, e a única forma de alguém
//     recebê-lo sem seguir é o CÓDIGO saltar por cima do portão. Precisa dar
//     ZERO, e herda o papel dos 43.476 casos da Fase 1b.
//
// C — A GARANTIA PELA REGRA, e ela é da revisão da Tarefa 4. Ela existe porque A,
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
//     o defeito que abriu aquela tarefa, é excluída de A por construção (ela chega
//     no link sem sair do portão, então o fluxo cai em B).
//
//     C recorta o oposto: SALTOS de fluxos NÃO gateados cujo DESTINO está a
//     jusante do portão (`alcança(G, destino)`). Aí não há filtro nenhum
//     protegendo o link — quem tem que barrar a pessoa é a REGRA, marcando o
//     portão na `Retomada`. C precisa dar ZERO, e um zero em C significa alguma
//     coisa: é o código, e só ele, que o produz.
//
//     E É C QUEM ACUSA OS DOIS PLANTIOS NOVOS, pelo mesmo motivo estrutural: em
//     fluxo gateado nenhuma `senao` e nenhum botão de menu conseguem chegar ao
//     link sem passar pelo portão, porque o filtro não deixa existir seta que
//     chegue no link vinda de outro lugar. A é cega para eles por construção, e o
//     zero dela ali não é sorte — é o recorte.
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

function medir(passos, ligacoes, arranjo, gateado, exemplos) {
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

// UMA VARREDURA: um espaço de topologias, um conjunto de arranjos, e o mesmo
// medidor. As duas varreduras deste arquivo diferem NISSO e em mais nada — nem
// no filtro, nem nos grupos, nem na cola do motor. É essa partilha que permite
// ler os dois blocos de números lado a lado.
function varrer(gerador, arranjos) {
  const t = {
    casosA: 0, vazamentosA: 0, pontosA: 0,
    casosC: 0, vazamentosC: 0, pontosC: 0,
    casosB: 0, vazamentosB: 0, pontosB: 0,
    descartadas: 0, exemplos: [],
  };

  for (const ligacoes of gerador) {
    // O PORTÃO PRECISA PODER PROTEGER O LINK. Sem caminho do portão até o link,
    // não há portão no caminho de ninguém e não há garantia a verificar — é fluxo
    // em que o dono não pôs portão nenhum na frente do link.
    if (!alcanca(ligacoes, ID.G, ID.L)) {
      t.descartadas++;
      continue;
    }
    // TODA SETA QUE CHEGA NO LINK SAI DO PORTÃO? Todo caminho até o link termina
    // numa seta que chega nele; se todas saem do portão, todo caminho passou por
    // ele. É a definição de "link gateado pela montagem", e é o que separa A de
    // C+B.
    const gateado = ligacoes.every((l) => l.para !== ID.L || l.de === ID.G);

    for (const arranjo of arranjos) {
      const passos = arranjo.map((p) => BLOCOS[p]);
      const entrada = passos[0].id;
      // Caso VAZIO não prova nada: se o link não é alcançável a partir da entrada,
      // nenhum fluxo normal chega nele e a medição não diz nada sobre o portão.
      if (entrada === ID.L || !alcanca(ligacoes, entrada, ID.L)) {
        t.descartadas++;
        continue;
      }

      const c = medir(passos, ligacoes, arranjo, gateado, t.exemplos);
      t.casosA += c.nA > 0 ? 1 : 0;
      t.pontosA += c.nA;
      t.vazamentosA += c.vA;
      t.casosC += c.nC > 0 ? 1 : 0;
      t.pontosC += c.nC;
      t.vazamentosC += c.vC;
      t.casosB += c.nB > 0 ? 1 : 0;
      t.pontosB += c.nB;
      t.vazamentosB += c.vB;
    }
  }
  return t;
}

function imprimir(titulo, t) {
  console.log("");
  console.log(`=== ${titulo} ===`);
  console.log("");
  console.log("A — A GARANTIA PELA MONTAGEM (toda seta que chega no link sai do portão)");
  console.log(`  casos (fluxo + ordem do array): ${t.casosA}`);
  console.log(`  saltos medidos (entrada + dentro):  ${t.pontosA}`);
  console.log(`  VAZAMENTOS:                     ${t.vazamentosA}`);
  console.log("");
  console.log("C — A GARANTIA PELA REGRA (link aberto pela montagem, portão a montante do destino)");
  console.log(`  casos (fluxo + ordem do array): ${t.casosC}`);
  console.log(`  saltos medidos (entrada + dentro):  ${t.pontosC}`);
  console.log(`  VAZAMENTOS:                     ${t.vazamentosC}`);
  console.log("");
  console.log("B — A FALHA FECHADA (portão não alcança o destino: nenhum código fecha)");
  console.log(`  casos:                          ${t.casosB}`);
  console.log(`  saltos medidos (entrada + dentro):  ${t.pontosB}`);
  console.log(`  entregas sem portão:            ${t.vazamentosB}`);
  console.log("");
  console.log(`descartados (portão não alcança o link, ou o link não é alcançável): ${t.descartadas}`);
  for (const e of t.exemplos) {
    console.log(`\n  exemplo de vazamento em ${e.grupo}`);
    console.log(`    arranjo:  ${e.arranjo}`);
    console.log(`    ponto:    ${e.ponto}`);
    console.log(`    retomada: ${JSON.stringify(e.retomada)}`);
    for (const l of e.ligacoes) console.log(`    seta:     ${l}`);
  }
}

console.log(`modo:   ${MODO_ANTIGO ? "ANTIGO (contraprova)" : "ATUAL"}`);
console.log(`steps:  ${CAMINHO_STEPS}`);

const exaustiva = varrer(topologias(), ARRANJOS);
imprimir("VARREDURA EXAUSTIVA (E, G, L, M, P — `sempre` e `botao`)", exaustiva);

const doMenu = varrer(topologiasDoMenu(), ARRANJOS_DO_MENU);
imprimir("VARREDURA DO MENU E DA `senao` (N, G, L, M, P — mais uma `senao`)", doMenu);

// O CÓDIGO DE SAÍDA OLHA A E C, NAS DUAS VARREDURAS, e olhar só A era o defeito
// que a revisão da Tarefa 4 pegou: o plantio do `haCaminho` levou B de 714.908
// para 2.045.528 e a varredura saía com código 0, porque A não o via. ESSES DOIS
// NÚMEROS SÃO HISTÓRICOS — da classificação ANTIGA, por ponto de entrada. Na
// classificação atual, por SALTO (ver "A UNIDADE DOS TRÊS É O SALTO" acima), o
// mesmo plantio deixa B em 261.536 — o número do cabeçalho no topo do arquivo,
// não este.
//
// E OLHAR SÓ A EXAUSTIVA era o defeito que a Tarefa 7c pegou: os dois plantios
// no caminho da `senao` e no do menu deixavam a exaustiva byte a byte idêntica.
// Uma varredura que dá zero pode estar certa ou pode não estar procurando, e
// esta esteve na segunda situação por duas tarefas.
//
// B FICA DE FORA do código de saída de propósito, nas duas. Ele não tem
// valor-alvo: é o tamanho da falha que a MONTAGEM abre e que nenhum código
// fecha, e prendê-lo a um número fixo aqui só criaria um limiar para alguém
// ajustar quando ele mudasse por motivo legítimo. O número de B é para ser LIDO,
// ao lado do da contraprova, não para passar num portão.
console.log("");
const vazouA = exaustiva.vazamentosA + doMenu.vazamentosA;
const vazouC = exaustiva.vazamentosC + doMenu.vazamentosC;
if (MODO_ANTIGO) {
  // A CONTRAPROVA COBRA A E C NAS DUAS VARREDURAS, sem distinção — a mesma
  // simetria que a exaustiva tem desde a Tarefa 4, e que a do menu só ganhou por
  // inteiro com a Tarefa 7c-débito devolvendo os dez arranjos a ela. Antes disso
  // a parcela do menu cobria só C: com os cinco arranjos (as ROTAÇÕES), A dela
  // dava ZERO contra o mesmo commit antigo — não porque o commit não vazasse em
  // A, mas porque o corte tirava do espaço percorrido os únicos arranjos que
  // acusam (as INVERTIDAS; a medição está em `arranjosDe`). Cobrir só C
  // escondia essa lacuna do próprio critério de saída; cobrir A também é o que
  // a expôs.
  const acusou =
    exaustiva.vazamentosA > 0 &&
    exaustiva.vazamentosC > 0 &&
    doMenu.vazamentosA > 0 &&
    doMenu.vazamentosC > 0;
  console.log(
    acusou
      ? "CONTRAPROVA OK: o código antigo vaza em A e em C na exaustiva, e em A e em C na do menu."
      : "CONTRAPROVA MUDA: a varredura não discrimina — um zero aqui não prova nada."
  );
  process.exitCode = acusou ? 0 : 1;
} else {
  const limpo = vazouA === 0 && vazouC === 0;
  console.log(limpo ? "SEM VAZAMENTO em A nem em C, nas duas varreduras." : "VAZOU.");
  process.exitCode = limpo ? 0 : 1;
}
