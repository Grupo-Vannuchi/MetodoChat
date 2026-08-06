// O fluxo de uma automação, como dado.
//
// Antes a sequência morava dentro do lib/engine.ts: advanceFlow chamava
// followGate, que chamava enqueueFollowups, nessa ordem e só nessa. Isso punha
// um teto na tela — um editor de blocos sobre aquele motor só poderia arrastar
// dois blocos, e arrastar os outros mostraria uma ordem que o motor não executa.
//
// Este arquivo é FUNÇÃO PURA de propósito: não toca banco, não chama a Meta, não
// conhece a fila. É a peça mais arriscada da mudança, e assim ela é a única
// testável sem banco — o que importa num projeto cuja suíte não abre conexão.

// O `id` é a identidade do bloco, e ele é OPCIONAL de propósito.
//
// O motivo NÃO é execução, e vale dizer porque a explicação anterior dizia que
// era: `conferir` nunca lê `o.id` — ela valida `tipo`, `texto`, `minutos`,
// `textos` e `emoji` —, e o `steps` chega do banco como `unknown[]`, ou seja,
// nada confere este tipo em runtime. Exigir `id` não recusaria bloco antigo
// nenhum; seria mudança só de tipo, sem efeito em execução.
//
// O motivo real é de TIPO, e é concreto: `Passo` é o que todo literal de passo
// precisa satisfazer, aqui e nos testes. Com `id` obrigatório, cada lista
// escrita à mão em tests/steps.test.ts — dezenas delas, que existem para fixar
// decisão de FLUXO e para as quais a identidade do bloco é irrelevante —
// deixaria de compilar, e o `tsc` do `npm run verify` só voltaria ao verde
// depois de inventar um id em cada uma.
//
// E o bloco antigo segue valendo de qualquer jeito: `identidadeDoPasso` lhe dá
// a identidade que ele sempre teve na prática, o índice.
type ComId = { id?: string };

export type Passo = ComId &
  (
    | { tipo: "resposta_publica"; textos: string[] }
    | { tipo: "dm"; texto: string; botao_label?: string; url?: string }
    | { tipo: "esperar"; minutos: number }
    | { tipo: "reagir_story"; emoji: string }
    | { tipo: "pedir_follow"; texto: string; botao_label: string }
    | { tipo: "pedir_email"; texto: string }
  );

// A posição no quadro é gravada junto, e NÃO participa de decisão nenhuma —
// nem de ordem, nem de validação, nem de execução. Quem define a ordem é o
// array. Isto está aqui só para o editor reabrir do jeito que foi deixado.
export type Posicao = { x: number; y: number };

// Um passo espera resposta quando ele PEDE alguma coisa.
//
// `dm` entra nessa conta quando tem rótulo de botão e não tem url: isso é uma
// resposta rápida, e resposta rápida existe para ser tocada. Com url é botão de
// link — a pessoa abre e a vida segue, sem nada para esperar.
//
// A distinção não foi inventada aqui: é exatamente como o formulário já grava,
// boas-vindas com rótulo e sem url, link com rótulo e com url.
function esperaResposta(p: Passo): boolean {
  if (p.tipo === "pedir_follow" || p.tipo === "pedir_email") return true;
  if (p.tipo === "dm") return Boolean(p.botao_label) && !p.url;
  return false;
}

export type AcaoEnfileirar = {
  passo: Passo;
  indice: number;
  // Atraso acumulado pelos `esperar` que vieram antes deste passo.
  atrasoSegundos: number;
};

export type Resultado = {
  enfileirar: AcaoEnfileirar[];
  // Índice do passo que espera resposta, ou null se a lista terminou.
  pararEm: number | null;
  ignorados: { indice: number; motivo: string }[];
};

// Valida e normaliza um passo. Devolve o motivo quando não dá para usar.
function conferir(p: unknown): { passo?: Passo; motivo?: string } {
  if (!p || typeof p !== "object") return { motivo: "passo não é um objeto" };
  const o = p as Record<string, unknown>;
  const tipo = o.tipo;

  if (tipo === "dm") {
    if (typeof o.texto !== "string" || !o.texto.trim()) return { motivo: "dm sem texto" };
    return { passo: p as Passo };
  }
  if (tipo === "esperar") {
    if (typeof o.minutos !== "number" || !Number.isFinite(o.minutos) || o.minutos < 0) {
      return { motivo: "esperar com minutos inválido" };
    }
    return { passo: p as Passo };
  }
  if (tipo === "resposta_publica") {
    if (!Array.isArray(o.textos) || !o.textos.length) return { motivo: "resposta pública vazia" };
    return { passo: p as Passo };
  }
  if (tipo === "reagir_story") {
    if (typeof o.emoji !== "string" || !o.emoji) return { motivo: "reagir_story sem emoji" };
    return { passo: p as Passo };
  }
  if (tipo === "pedir_follow") {
    if (typeof o.texto !== "string" || !o.texto.trim()) return { motivo: "pedir_follow sem texto" };
    return { passo: p as Passo };
  }
  if (tipo === "pedir_email") {
    if (typeof o.texto !== "string" || !o.texto.trim()) return { motivo: "pedir_email sem texto" };
    return { passo: p as Passo };
  }
  return { motivo: `tipo desconhecido: ${String(tipo)}` };
}

// A forma do id, e por que ela é conferida em vez de aceita.
//
// A identidade entra na `dedupe_key`. Um id como "2" colidiria com a chave por
// índice de um OUTRO bloco — a chave é a mesma string —, e colisão em
// `dedupe_key` não dá erro: o `on conflict do nothing` engole o segundo item e
// a pessoa deixa de receber uma mensagem, sem nada aparecer em lugar nenhum.
// O prefixo `b_` torna isso impossível por construção.
const FORMA_DO_ID = /^b_[0-9a-z]{6,}$/;

// Quem este passo é, para efeito de deduplicação e de cursor.
//
// Com id, é o id: ele acompanha o bloco quando ele é arrastado, e é isso que
// faz reordenar deixar de reenviar mensagem.
//
// Sem id, é o índice — e isso não é remendo. Um bloco gravado antes da Fase 1b
// JÁ tem itens na fila com a chave por índice; devolver o índice é o que faz
// essas chaves continuarem casando. Se devolvesse outra coisa, o primeiro
// deploy reentregaria tudo que já saiu hoje.
export function identidadeDoPasso(passo: unknown, indice: number): string {
  const id = (passo as { id?: unknown } | null | undefined)?.id;
  return typeof id === "string" && FORMA_DO_ID.test(id) ? id : String(indice);
}

// Onde, na lista de hoje, está o bloco com esta identidade.
//
// COM ID, a garantia é firme, e é a razão desta fase existir: null quando o
// bloco não existe mais — o dono o apagou —, e reordenar NÃO cai aqui, porque o
// bloco continua na lista e só mudou de lugar. É isso que faz o cursor
// sobreviver à reordenação.
//
// SEM ID a garantia NÃO VALE, e o modo de falhar é o pior possível: a identidade
// É a posição, então ela não acompanha o bloco. Apagar ou inserir na lista faz a
// mesma identidade resolver para OUTRO bloco, calado — não devolve null:
//
//   [ {id:b_aaa}, {sem id: dois}, {sem id: três} ]   identidades: b_aaa, "1", "2"
//   apaga o primeiro:
//   [ {sem id: dois}, {sem id: três} ]               identidades: "0", "1"
//   indiceDoId(lista, "1") → 1                       que agora é "três", OUTRO bloco
//
// Repare que são precisos DOIS blocos sem id para o erro aparecer. Com um só, a
// identidade procurada some da lista e a função devolve null — errado também,
// mas barulhento. É a vizinhança de blocos sem id que troca um pelo outro em
// silêncio, e silêncio é o que custa caro.
//
// Isso importa porque o cursor (Tarefa 2) é montado em cima desta função, e
// retomar do bloco errado é o defeito que a fase anterior gastou duas ondas para
// matar — entregar o link a quem não segue.
//
// O que segura o caso na prática é o DADO, não esta função: o script
// `scripts/dar-ids-aos-passos.mjs` dá id a todo bloco de toda automação já
// gravada, e `montarPassos` (app/automacoes/actions.ts) grava id em tudo que
// cria, `esperar` inclusive. Depois disso, lista com bloco sem id não é
// produzida por caminho nenhum do sistema. O teste em tests/steps.test.ts fixa a
// limitação para ela não voltar em silêncio se essa premissa mudar.
export function indiceDoId(passos: unknown, id: string): number | null {
  if (!Array.isArray(passos)) return null;
  for (let i = 0; i < passos.length; i++) {
    if (identidadeDoPasso(passos[i], i) === id) return i;
  }
  return null;
}

// O passo em que o cursor de um contato está parado — validado, e confirmado
// como passo de espera.
//
// Existe porque quem lê o cursor (lib/engine.ts) lê `steps[i]` CRU do banco, e
// confiar no `tipo` sem passar pela mesma validação do interpretador diverge do
// que o fluxo faz: um `pedir_email` sem texto é ignorado por `interpretar` — e
// portanto nunca foi enviado —, mas o ramo do cursor o trataria como pedido de
// e-mail e consumiria a mensagem da pessoa como endereço.
//
// Devolve undefined quando o índice não existe mais, quando o passo não passa
// na validação, ou quando ele não espera resposta nenhuma. Esse último caso é
// cursor obsoleto: a lista foi editada depois de o cursor ser gravado, e não há
// resposta a esperar naquele índice.
export function passoEsperado(passos: unknown, indice: number): Passo | undefined {
  if (!Array.isArray(passos)) return undefined;
  const { passo } = conferir(passos[indice]);
  if (!passo || !esperaResposta(passo)) return undefined;
  return passo;
}

// Percorre a lista a partir de `deIndice` e diz o que fazer.
//
// `esperar` NÃO é enfileirado: ele soma no atraso dos passos seguintes. É assim
// que a fila já funciona — cada item carrega o próprio atraso —, então espera
// como passo custa zero mudança no dreno.
export function interpretar(passos: unknown, deIndice: number): Resultado {
  const r: Resultado = { enfileirar: [], pararEm: null, ignorados: [] };

  if (!Array.isArray(passos)) {
    r.ignorados.push({ indice: -1, motivo: "a automação não tem lista de passos" });
    return r;
  }

  // Lista VAZIA tem que dar sinal, e por um motivo que não é simetria: é a
  // única forma de falha do produto que passaria sem deixar rastro nenhum.
  //
  // O laço abaixo simplesmente não itera, e o resultado sai
  // `{enfileirar: [], pararEm: null, ignorados: []}` — indistinguível de uma
  // lista que terminou. O motor então limpa o cursor e ninguém recebe nada,
  // sem uma linha em Atividade dizendo por quê.
  //
  // E não é caso hipotético: `[]` é o `default '[]'::jsonb` da coluna, ou
  // seja, é exatamente o que toda automação criada ANTES desta branch tem até
  // alguém salvá-la de novo pelo formulário.
  //
  // O motivo é próprio, e não o mesmo de "não é lista", porque as duas causas
  // são diferentes: aqui a coluna está íntegra e o conteúdo é que falta.
  if (!passos.length) {
    r.ignorados.push({ indice: -1, motivo: "a automação não tem nenhum passo" });
    return r;
  }

  let atrasoSegundos = 0;

  for (let i = Math.max(0, deIndice); i < passos.length; i++) {
    const { passo, motivo } = conferir(passos[i]);
    if (!passo) {
      r.ignorados.push({ indice: i, motivo: motivo! });
      continue;
    }

    if (passo.tipo === "esperar") {
      atrasoSegundos += passo.minutos * 60;
      continue;
    }

    r.enfileirar.push({ passo, indice: i, atrasoSegundos });

    if (esperaResposta(passo)) {
      r.pararEm = i;
      return r;
    }
  }

  return r;
}

// Quantos passos da lista PARAM o fluxo de vez.
//
// Só a `dm` de resposta rápida entra nesta conta, e a distinção não é
// decorativa: `pedir_follow` e `pedir_email` são portões que a própria execução
// reavalia (o portão reconsulta a Meta; o pedido de e-mail é pulado quando o
// endereço já é conhecido), então o fluxo pode atravessá-los sozinho. A `dm` de
// resposta rápida não: nada além do toque da pessoa a destrava.
//
// Passo inválido não conta, pelo mesmo motivo de `passoEsperado`: `interpretar`
// o ignora, então ele nunca foi enviado e nunca parou nada.
function contarParadasDuras(passos: unknown[]): number {
  let n = 0;
  for (const p of passos) {
    const { passo } = conferir(p);
    if (passo && passo.tipo === "dm" && esperaResposta(passo)) n++;
  }
  return n;
}

// O índice do PRIMEIRO portão de follow da lista. Null quando não há nenhum.
//
// Existe para o toque em "Já sigo!" ter um ponto de partida quando o cursor não
// serve — e o ponto de partida afirmável, nesse caso, é o portão: o payload
// `FOLLOW:<id>` só existe porque o portão daquela automação foi entregue, então
// o toque AFIRMA onde a pessoa está.
//
// Sem isto, o motor caía no zero, e o zero é inútil para toda lista que o
// formulário grava: a boas-vindas vem sempre antes do portão e sempre com
// rótulo e sem url (`esperaResposta` → parada dura), então `interpretar` a
// partir do zero para NELA e o portão nunca é alcançado. O toque no botão não
// fazia nada.
//
// Passo inválido não conta, pela mesma regra de `contarParadasDuras` e
// `passoEsperado`: `interpretar` o ignora, logo ele nunca foi enviado e não é
// portão nenhum. Retomar de um `pedir_follow` sem texto entregaria a quem não
// segue tudo o que vem depois dele.
//
// COM MAIS DE UM PORTÃO, o primeiro vence, e o preço precisa estar dito — mas
// ele encolheu, e a data importa. O payload `FOLLOW:<automação>` nomeava só a
// automação: quem estava parado no SEGUNDO portão e tocava em "Já sigo!" sem
// cursor desta automação retomava no primeiro, e tudo o que houvesse entre os
// dois era reentregue. Desde a Fase 1b o payload leva o BLOCO junto
// (`FOLLOW:<automação>:<bloco>`), e o toque nomeia o portão em que a pessoa
// tocou — `retomadaDoFollow` acha aquele bloco e nem chega aqui.
//
// Esta função continua sendo o ponto afirmável dos casos em que o bloco não
// resolve, e todos eles são reais e permanentes: botão entregue ANTES da Fase 1b
// (que vive na conversa para sempre), e botão cujo bloco não está mais na lista.
// Nesses, com dois portões, o primeiro ainda vence e a reentrega descrita acima
// ainda vale. Nenhuma lista do formulário chega a isso — `montarPassos`
// (app/automacoes/actions.ts) emite um portão só —, mas lista montada à mão
// chega, e é para lá que a Fase 1b vai.
export function indiceDoPortao(passos: unknown): number | null {
  if (!Array.isArray(passos)) return null;
  for (let i = 0; i < passos.length; i++) {
    const { passo } = conferir(passos[i]);
    if (passo && passo.tipo === "pedir_follow") return i;
  }
  return null;
}

// O cursor, como ele sai do banco: qual bloco e de qual automação.
//
// Recebe os dois porque um sem o outro não quer dizer nada — o id é único
// dentro de UMA automação, e o mesmo id pode existir em outra.
export type Cursor = { passoId: string | null; automationId: string | null };

// O BLOCO do cursor, mas SÓ quando ele é desta automação. Null nos demais
// casos — inclusive quando existe um cursor, de outra.
//
// Veio de lib/engine.ts pelo mesmo motivo de `retomadaDoFallback`: é decisão
// pura, e ela segura o bloqueador mais grave desta onda — a identidade só é
// única dentro de UMA lista, e cada automação tem a sua. Aplicar o cursor de B à
// lista de A pula passos de A (o portão de follow inclusive, entregando o link a
// quem não segue) ou aponta para bloco nenhum.
//
// Guardar o BLOCO em vez da posição não dispensa esta conferência, e chega a
// aumentar a chance de ela ser necessária: a identidade de um bloco sem id é o
// índice em texto (`identidadeDoPasso`), então o cursor "1" de B casa com o
// segundo bloco de A sem nada acusar. Para bloco com id o encontro é
// improvável, mas ele não é impossível por construção — nada impede a mesma
// automação ser duplicada com os ids dentro.
//
// Recebe o cursor já lido do banco, e não o contato inteiro, para não arrastar
// o tipo `Contact` (lib/db.ts, `server-only`) para dentro deste arquivo.
//
// Quem chama decide o que fazer com o null, e a resposta não é a mesma nos dois
// ramos: o toque numa resposta rápida (`AUTO:`) não afirma posição nenhuma e
// começa do zero; o toque no "Já sigo!" (`FOLLOW:`) afirma o portão, e usa
// `indiceDoPortao`.
export function cursorDesta(cursor: Cursor, automationId: string): string | null {
  return cursor.automationId === automationId ? cursor.passoId : null;
}

// O que um botão de resposta rápida carrega: de qual automação ele é, e — desde
// a Fase 1b — de qual BLOCO.
export type Payload = {
  prefixo: "AUTO" | "FOLLOW";
  automationId: string;
  passoId: string | null;
};

// Lê o payload de um botão de resposta rápida.
//
// DUAS FORMAS, e as duas são finais:
//
//   `AUTO:<automação>`            entregue antes da Fase 1b
//   `AUTO:<automação>:<bloco>`    entregue a partir dela
//
// A forma antiga NÃO é dívida a limpar, e este parágrafo existe para ninguém a
// "limpar" depois. Um botão entregue vive na conversa da pessoa indefinidamente,
// e ela pode tocar nele meses depois — apagar este ramo quebraria todo botão já
// enviado, de uma vez, e o sintoma seria "o botão não faz mais nada" sem erro
// nenhum em lugar algum: `lerPayload` devolveria null, `handleMessagingEvent`
// não faria nada, e não há linha em Atividade para um toque que não decide nada.
// Não há data em que este ramo pare de ser alcançado.
//
// O `<bloco>` é a identidade que `identidadeDoPasso` dá ao passo, e ela é o id
// (`b_...`) ou o ÍNDICE EM TEXTO, para bloco sem id. Nada aqui confere a forma
// dela de propósito: exigir o prefixo `b_` recusaria o botão de toda automação
// que a migração (`scripts/dar-ids-aos-passos.mjs`) não alcançou. Quem confere
// se aquele bloco ainda existe é `indiceDoId`, na hora de usar.
//
// O id da automação é um uuid: ele tem hífen, e não tem dois-pontos. É por isso
// que separar por `:` basta, e que mais de três partes é payload que não é
// nosso, e não automação com nome esquisito.
//
// Devolve null para qualquer outra coisa, e isso é obrigatório: o webhook recebe
// o que a Meta manda, e a Meta manda o que o cliente digitou.
export function lerPayload(payload: unknown): Payload | null {
  if (typeof payload !== "string") return null;
  const partes = payload.split(":");
  // Só o limite de cima é conferido aqui. O de baixo ("AUTO" sozinho, uma
  // parte) não precisa de guarda própria: `automationId` sai `undefined`
  // dessa desestruturação, e `!automationId`, logo abaixo, já mata o caso.
  // Uma guarda para `partes.length < 2` seria redundante — nenhuma mutação a
  // mataria, porque ela não decide nada que outra linha já não decida.
  if (partes.length > 3) return null;
  const [prefixo, automationId, passoId] = partes;
  if (prefixo !== "AUTO" && prefixo !== "FOLLOW") return null;
  if (!automationId) return null;
  // Três partes com a última em branco (`AUTO:auto-1:`) não é "bloco vazio", é
  // payload malformado. Aceitar poria `passoId: ""` no ramo do payload, e ""
  // não é identidade de bloco nenhum: `indiceDoId` devolveria null e o toque
  // cairia no zero, reenviando a boas-vindas. Como null, ele usa o cursor.
  if (partes.length === 3 && !passoId) return null;
  return { prefixo, automationId, passoId: passoId ?? null };
}

// Qual cursor vale no toque de um botão: o REAL do contato, ou o bloco que veio
// no payload do botão.
//
// O CURSOR MANDA; o payload é reserva. A ordem não é detalhe, e a versão
// anterior desta fase tinha a ordem invertida.
//
// O payload nomeia o BOTÃO em que a pessoa tocou. O cursor diz onde ela
// realmente ESTÁ — e ele é sempre a informação mais recente dos dois, porque o
// botão fica congelado na conversa desde o dia em que foi entregue e continua
// tocável para sempre.
//
// Preferir o payload rebobinava quem já tinha avançado: quem atravessou o portão
// de follow e está parado num bloco adiante, ao tocar num "Já sigo!" antigo,
// voltava ao portão — e `executarFluxo` (lib/engine.ts) reenfileira tudo entre o
// portão e onde a pessoa estava, deduplicado só dentro do dia. Trocava um
// problema por reentrega, que é exatamente o preço que a onda anterior recusou
// pagar quando decidiu não pôr guarda no `retomadaDoBotao`.
//
// O que o payload continua resolvendo, e é por isso que ele não é inútil:
//
//   CURSOR DE OUTRA AUTOMAÇÃO — tocar num botão antigo da automação A enquanto
//     se está no meio da B recomeçava a A do ZERO, porque `cursorDesta` descarta
//     o cursor de B e não sobrava nada a afirmar. Com o payload, o toque diz de
//     qual automação e de qual ponto ele fala.
//   NENHUM CURSOR — mesma coisa, sem o cursor emprestado.
//   BLOCO DO CURSOR QUE SUMIU DA LISTA — `indiceDoId` devolve null, o cursor não
//     afirma nada, e o bloco do botão é o que sobra.
//
// A conferência com `indiceDoId` é o que torna a reserva alcançável, e ela não é
// simetria: um cursor desta automação apontando para bloco que não está mais na
// lista é tão mudo quanto cursor nenhum. Sem ela, esse caso cairia no cursor e o
// payload nunca seria usado com cursor desta automação presente.
//
// SEM BLOCO NO PAYLOAD (botão entregue antes da Fase 1b, `AUTO:<automação>`) a
// reserva é o cursor VAZIO, e não "o payload": não há bloco nenhum a afirmar.
// Daí `retomadaDoBotao` cai no zero e `retomadaDoFollow` cai no portão, que é o
// que eles já faziam com cursor nulo — a compatibilidade com o botão antigo sai
// de graça, sem ramo próprio.
//
// ---------------------------------------------------------------------------
// UM AVISO PARA QUEM MEXER AQUI DEPOIS, e ele custou uma onda para ser aprendido:
//
//   TESTE DE FUNÇÃO PURA NÃO VÊ O MOTOR TROCAR O ARGUMENTO QUE PASSA PARA ELA.
//
// O teste "cursor DESTA num bloco DEPOIS do portão retoma DELE, não do portão"
// (tests/steps.test.ts) existe justamente para impedir que quem já atravessou o
// portão volte a ele. Quando a fase anterior passou a alimentar
// `retomadaDoFollow` com o bloco do PAYLOAD em vez do cursor do contato, esse
// teste continuou VERDE — a função não mudou, o argumento é que mudou. O defeito
// atravessou a suíte inteira sem acender uma luz.
//
// É por isso que a escolha do cursor mora AQUI, numa função pura com teste, e
// não como expressão solta dentro de `server-only`: enquanto ela estiver aqui, o
// teste que compõe `cursorDaRetomada` com `retomadaDoBotao`/`retomadaDoFollow`
// pega a troca. Quem voltar a decidir isto em lib/engine.ts reabre a classe de
// defeito que esta suíte, estruturalmente, não pega.
// ---------------------------------------------------------------------------
export function cursorDaRetomada(
  real: Cursor,
  automationId: string,
  passoIdDoBotao: string | null,
  passos: unknown
): Cursor {
  const id = cursorDesta(real, automationId);
  if (id !== null && indiceDoId(passos, id) !== null) return real;
  return passoIdDoBotao === null
    ? { passoId: null, automationId: null }
    : { passoId: passoIdDoBotao, automationId };
}

// De qual passo o toque num botão de RESPOSTA RÁPIDA (`AUTO:`) retoma.
//
// Veio de lib/engine.ts inteira, e não em pedaços, porque era a composição — e
// não as peças — que estava sem teste. `cursorDesta`, `indiceDoPortao` e
// `passoEsperado` sempre foram puras e cobertas; a ESCOLHA entre elas morava
// dentro de `server-only`, onde nenhum teste chega, e foi essa escolha que
// produziu defeito nas duas ondas anteriores.
//
// O `cursor` que chega aqui tem DUAS procedências, e quem escolhe entre elas é
// `cursorDaRetomada` (acima), não lib/engine.ts:
//
//   CURSOR DO CONTATO, lido do banco — o caso NORMAL. Onde a pessoa realmente
//     parou. Vale sempre que for desta automação e o bloco ainda estiver na
//     lista.
//   BLOCO DO PAYLOAD (`AUTO:<automação>:<bloco>`) — a RESERVA, só quando o
//     cursor não serve: nulo, de outra automação, ou apontando para bloco que
//     sumiu. Aí a automação é sempre esta por construção, `cursorDesta` nunca o
//     descarta, e o bloco é sempre uma `dm` de resposta rápida, porque é o
//     único passo que emite esse payload (`enfileirarPasso`, lib/engine.ts).
//
//     ISSO NÃO BASTA para garantir que o `+1` (abaixo) nunca pule um portão:
//     ele soma sobre a POSIÇÃO do bloco na lista, não sobre o tipo dele. A
//     conta só fecha ENQUANTO TODA `dm` de resposta rápida da lista vier ANTES
//     de qualquer portão — é o que o formulário garante hoje (uma só, e é a
//     boas-vindas, que vem primeiro) e o que o quadro de blocos livres NÃO vai
//     garantir. Havendo uma `dm` de resposta rápida DEPOIS de um portão, o
//     `+1` cai depois dele e o portão não é reavaliado. Este é o mesmo
//     problema que a Tarefa 6 do plano (`docs/plans/2026-08-06-editor-em-
//     blocos.md`, Passo 5) já registra pela reordenação preservando ids; a
//     decisão de lá precisa cobrir os dois caminhos, não só aquele.
//
// O botão ANTIGO (`AUTO:<automação>`) não traz bloco: a reserva dele é o cursor
// vazio, e ele cai no ramo do zero, abaixo. Não tem prazo para acabar — botão
// entregue antes da Fase 1b continua tocável para sempre.
//
// Os ramos de PORTÃO, por isso, não são código morto nem quando a reserva ganha.
// Um bloco `dm` editado depois da entrega do botão pode ter virado `pedir_follow`
// ou `pedir_email`, e aí o toque cai neles com a mesma razão de sempre: o toque
// não é a resposta que um portão espera. E pelo cursor do contato eles são o
// caminho COMUM: quem está parado num portão está parado nele.
//
// Com cursor DESTA automação, a regra tem dois ramos:
//
//   `dm` de resposta rápida → retoma do SEGUINTE. O toque É a resposta que ela
//     esperava, exatamente como no ramo de texto de lib/engine.ts.
//   PORTÃO — `pedir_follow` ou `pedir_email` → retoma DELE MESMO. O `+1` aqui
//     era o defeito: quem está parado no portão de A continua podendo tocar no
//     botão antigo da boas-vindas de A, que segue tocável na mensagem já
//     entregue. O cursor é o do portão, o `+1` o pulava. A alcançabilidade é a
//     MESMA do botão "Já sigo!" antigo: se botão antigo não fosse tocável, o
//     defeito que a onda passada corrigiu no ramo `FOLLOW:` também não
//     existiria.
//
// Os DOIS tipos entram, e a `dm` de resposta rápida não, porque a diferença
// está no que o toque significa em cada um. Na `dm` o toque É a resposta
// esperada — avançar é atender a pessoa. No portão não é: o que o portão espera
// é o follow ou o endereço, e o toque não os entrega, então avançar é dar por
// respondido o que ninguém respondeu.
//
//   `pedir_follow`: pular entregava o link e os lembretes a quem NÃO SEGUE — a
//     promessa central do produto. Retomando dele, `resolverFollow` reconsulta
//     a Meta e quem não segue continua barrado.
//   `pedir_email`: pular esvaziava a opção que o dono marcou justamente para
//     capturar o endereço — o pedido some em silêncio e o e-mail nunca chega.
//
// Retomar do pedido de e-mail é seguro e idempotente: `executarFluxo` já pula o
// passo sozinho quando o e-mail do contato é conhecido (o ramo `pedir_email`
// consulta `contacts.email` e segue para o índice seguinte), então quem já
// respondeu não fica preso; e quem não respondeu recebe o pedido de novo,
// deduplicado por `emailAskKey` no balde do dia.
//
// Com isso os três ramos param nos mesmos portões: o de texto, o `FOLLOW:` e
// este.
//
// SEM cursor desta automação — nulo, ou de outra —, retoma de 0. Cursor de
// outra automação é bloco de outra lista, e o zero é o único ponto afirmável
// para o null: ele tanto pode ser "nunca começou" quanto "o fluxo TERMINOU"
// (`executarFluxo` limpa o cursor no fim da lista), e a coluna não separa os
// dois. Repetir a lista é recuperável — ela para na primeira parada dura, e a
// `passoKey` segura o dia; começar no meio às cegas não é.
//
// CURSOR OBSOLETO tem DUAS formas, e elas não caem no mesmo lugar.
//
// BLOCO QUE SUMIU da lista — `indiceDoId` devolve null — retoma do ZERO. Antes
// desta fase o equivalente era "índice obsoleto", que caía no `+1`; agora não
// há índice em que somar, e o zero é o único ponto afirmável — o mesmo
// raciocínio do cursor nulo, logo acima.
//
// Quem chega aqui com bloco sumido é, agora, quem tem os DOIS sumidos:
// `cursorDaRetomada` (acima) só entrega o bloco do payload quando o cursor do
// contato não resolve, então cair no zero exige que o cursor não sirva E que o
// bloco do botão também não esteja mais na lista. Uma versão anterior desta fase
// preferia o payload, e aí bastava o bloco do BOTÃO ter sumido para a pessoa
// perder um lugar que o cursor sabia — o cursor se recupera na primeira
// interação seguinte, o bloco congelado no botão não se recupera nunca. A
// inversão fechou isso.
//
// O caso dos dois sumidos continua real enquanto `montarPassos`
// (app/automacoes/actions.ts) gerar id novo a cada salvamento: um save órfã o
// cursor e todos os botões entregues de uma vez. A janela fecha na Tarefa 8.
//
// BLOCO QUE CONTINUA na lista mas não espera mais nada — foi editado e virou
// botão de link, ou ficou inválido — cai no `+1`, como antes, e a escolha segue
// deliberada. Passo que não espera não é portão, então avançar não pula portão
// nenhum: os que vierem depois continuam sendo interpretados normalmente. Do
// zero, a alternativa, a boas-vindas sairia de novo. Quando o `+1` cai além do
// fim da lista, `interpretar` não enfileira nada e `executarFluxo` limpa o
// cursor: o toque não faz nada, e a pessoa destrava mandando qualquer mensagem.
//
// A diferença que esta fase pretende, e ela AINDA NÃO VALE: com id, o bloco
// deveria sumir só quando o dono o apaga, e reordenar não contaria.
//
// HOJE o bloco some a cada SALVAMENTO, e é preciso dizer isso sem rodeio.
// `montarPassos` (app/automacoes/actions.ts) chama `novoIdDeBloco()` em todo
// bloco a cada save, e o `update` grava o `steps` inteiro sem casar com os ids
// antigos. Enquanto o formulário existir — e ele é o único editor até a Tarefa
// 8 —, todo salvamento reescreve os ids e ÓRFÃ o cursor de todo mundo que
// estiver em fluxo, reordenação ou não.
//
// E o estrago não para no cursor órfão: a identidade entra na `passoKey`, então
// a boas-vindas já enviada está gravada com `passo:A:C:b_ANTIGO:dia`, o
// recomeço do zero enfileira com `passo:A:C:b_NOVO:dia`, o `on conflict` não
// pega, e a pessoa recebe a boas-vindas DUAS VEZES. Com cursor por índice o
// mesmo save não causava nada disso.
//
// A janela está declarada no plano e fecha na Tarefa 8, quando o quadro
// substituir o formulário e passar a preservar os ids ao salvar. Só a partir
// daí "o bloco só some quando o dono o apaga" descreve o sistema.
//
// Com a medida certa, porém: isso vale para bloco COM id. Para bloco SEM id a
// identidade É a posição (`identidadeDoPasso`), então ela não acompanha o
// bloco, e editar a lista faz o cursor resolver para OUTRO bloco em silêncio,
// sem passar por este null — o comentário de `indiceDoId`, acima, descreve o
// caso por inteiro. O que segura isso é o DADO, não esta função: depois da
// migração (`scripts/dar-ids-aos-passos.mjs`) e de `montarPassos`
// (app/automacoes/actions.ts), lista com bloco sem id não é produzida por
// caminho nenhum do sistema.
export function retomadaDoBotao(
  cursor: Cursor,
  automationId: string,
  passos: unknown
): number {
  const id = cursorDesta(cursor, automationId);
  if (id === null) return 0;
  const indice = indiceDoId(passos, id);
  if (indice === null) return 0;
  const tipo = passoEsperado(passos, indice)?.tipo;
  return tipo === "pedir_follow" || tipo === "pedir_email" ? indice : indice + 1;
}

// De qual passo o toque em "Já sigo!" (`FOLLOW:`) retoma.
//
// Mesma mudança de casa de `retomadaDoBotao`, e pelo mesmo motivo: o
// comportamento é o que a onda passada instalou, o que faltava era teste.
//
// O `cursor` tem as mesmas duas procedências de `retomadaDoBotao`, escolhidas
// por `cursorDaRetomada` (acima): o cursor do CONTATO manda, o bloco do PAYLOAD
// é reserva. Aqui essa ordem tem consequência de produto, e vale escrevê-la.
//
// O GANHO da reserva: o bloco do payload de um "Já sigo!" é o do PORTÃO que
// entregou aquele botão. Numa lista com dois portões, quem não tem cursor útil
// desta automação passa a retomar do portão CERTO em vez do primeiro — é a
// dívida que o comentário de `indiceDoPortao` (acima) registrava como adiada.
//
// E o que a ordem PROTEGE: quem JÁ atravessou o portão e está parado adiante, na
// mesma automação, toca de novo no "Já sigo!" antigo e CONTINUA onde estava. Uma
// versão anterior desta fase preferia o payload e o mandava de volta ao portão,
// reenfileirando tudo entre os dois — a `passoKey` só segura isso dentro do dia.
// É esse caso que o teste "cursor DESTA num bloco DEPOIS do portão retoma DELE"
// (tests/steps.test.ts) sempre pretendeu impedir; ele não pegou a regressão
// porque o que mudou não foi a função, foi quem alimentava o argumento dela. O
// aviso inteiro está no comentário de `cursorDaRetomada`.
//
// Com cursor DESTA automação, retoma DELE, seja ele qual for. A promessa "o
// portão é reavaliado, não pulado" vale QUANDO O BLOCO DO CURSOR É O PORTÃO —
// aí retomar dele é reconsultar a Meta, que é o ponto do botão.
//
// QUANDO NÃO É, o toque não faz nada, e isso precisa estar dito. Com o cursor
// na boas-vindas, a função devolve o índice DELA; `interpretar` a partir daí
// para na mesma parada dura e `executarFluxo` regrava o cursor no mesmo lugar.
// Nada avança, nada é enfileirado, e tocar em "Já sigo!" de novo repete o nada.
//
// Não é regressão desta tarefa — o comportamento é o que a onda passada
// instalou — e a pessoa destrava por outro caminho: mandando qualquer texto (o
// ramo de fallback) ou tocando no botão de resposta rápida, que avança do
// SEGUINTE. Fica anotado, não consertado aqui.
//
// A não ser que o BLOCO tenha sumido da lista, e esse ramo é novo desta fase:
// com índice, um número sempre resolvia para alguma coisa, então cursor desta
// automação nunca chegava ao `??`. Agora `indiceDoId` sabe dizer "esse bloco
// não está mais aqui", e aí o cursor não afirma nada — cai no portão, junto com
// o caso de não haver cursor desta, e pelo mesmo motivo.
//
// Sem cursor desta, o ponto de partida NÃO é o zero, e é aqui que este ramo
// difere do `AUTO:`: o payload `FOLLOW:<id>` só existe porque o portão desta
// automação foi entregue, então o toque AFIRMA onde a pessoa está. O zero era
// no-op para toda lista que o formulário grava, e por construção: a boas-vindas
// é obrigatória, vem antes do portão e sempre com rótulo e sem url — parada
// dura. `interpretar` do zero parava NELA, nunca chegava ao portão, e ainda
// gravava o cursor na boas-vindas, de modo que o toque seguinte encontrava esse
// cursor (agora desta automação) e parava no mesmo lugar: o "Já sigo!" nunca
// mais funcionava.
//
// O PREÇO de retomar do portão, por inteiro, porque ele NÃO é o mesmo do zero
// no ramo `AUTO:`: se o fluxo já tinha terminado (cursor limpo), o `AUTO:` do
// zero esbarra na parada dura da boas-vindas e o estrago é UMA mensagem
// repetida. Do portão não há parada dura depois dele numa lista do formulário —
// o que vem é o link e os lembretes, nenhum deles resposta rápida —, então
// `interpretar` enfileira a CAUDA INTEIRA e devolve `pararEm: null`. A
// `passoKey` só segura dentro do dia; virado o balde, um toque num "Já sigo!"
// antigo reentrega tudo de novo. A decisão continua valendo, porque a
// alternativa é não responder nada a quem acabou de tocar no botão, mas ela se
// paga em mensagens repetidas, não em uma.
//
// O `?? 0` final é alcançável PELO FORMULÁRIO, e não só por lista montada à
// mão: basta o dono desmarcar "exigir follow" e salvar. `montarPassos`
// (app/automacoes/actions.ts) para de emitir o `pedir_follow`, e os botões
// `FOLLOW:<id>` já entregues continuam tocáveis nas conversas antigas. É "lista
// que não tem portão AGORA", e aí o zero é mesmo o único ponto afirmável.
export function retomadaDoFollow(
  cursor: Cursor,
  automationId: string,
  passos: unknown
): number {
  const id = cursorDesta(cursor, automationId);
  const indice = id === null ? null : indiceDoId(passos, id);
  return indice ?? indiceDoPortao(passos) ?? 0;
}

// De qual passo o fallback retoma. Null quando não dá para afirmar.
//
// Veio de lib/engine.ts, onde era pura e por isso não testável — e onde esteve
// no centro de dois defeitos. Aqui ela é coberta por teste.
//
// O contexto: `shouldFallbackFollowup` (lib/engine.ts) respondeu "já houve
// boas-vindas e o link não saiu", e a intenção sempre foi MANDAR O LINK — não
// recomeçar a conversa.
//
// A dedução: `interpretar` a partir do zero enfileira tudo até o primeiro passo
// de espera e para NELE. Como a boas-vindas comprovadamente saiu, tudo até esse
// passo já foi entregue, e o que veio depois nunca chegou a ser enfileirado.
//
//   `dm` de resposta rápida → retoma do SEGUINTE. O que ela esperava era o
//     toque no botão, que não veio; o texto que a pessoa mandou vale como
//     resposta, do mesmo jeito que no ramo do cursor.
//   portão de follow ou pedido de e-mail → retoma DELE MESMO, para o portão
//     reconsultar a Meta e o e-mail ser reavaliado. Pular entregaria o link a
//     quem não segue.
//
// O CRITÉRIO CONSERVADOR, e por que ele existe: a dedução acima só vale
// enquanto houver no máximo UMA parada dura na lista (ver `contarParadasDuras`).
// É o que toda lista gravada pelo formulário tem hoje — a boas-vindas é a única
// `dm` com rótulo e sem url —, mas a Fase 1b deixa montar a lista livremente, e
// com duas `dm` de resposta rápida seguidas a dedução vira mentira: a pessoa
// pode ter tocado no primeiro botão, recebido a segunda `dm` e travado ALI. Como
// nenhuma dessas duas é `dm_link`, `shouldFallbackFollowup` continua dizendo sim
// a cada mensagem, e retomar do índice deduzido REENVIA a segunda — mensagem
// repetida para pessoa real.
//
// Havendo mais de uma, não retoma nada. Mandar nada é recuperável: a pessoa
// manda outra mensagem, ou toca no botão que ainda está lá. Mandar de novo o que
// já foi mandado não é.
//
// Os portões ficam fora da conta de propósito: o fallback retoma DELES MESMOS,
// sem afirmar nada sobre o que veio depois, e reenviá-los é o comportamento
// pretendido — o portão só é portão se cada tentativa reconsultar.
//
// Sem passo de espera nenhum, a lista teria sido enfileirada inteira — link
// incluído — e `shouldFallbackFollowup` não teria dito sim. Se ainda assim
// acontecer, também não retoma nada: repetir a lista manda mensagem repetida.
export function retomadaDoFallback(passos: unknown): number | null {
  const { pararEm } = interpretar(passos, 0);
  if (pararEm === null) return null;
  if (Array.isArray(passos) && contarParadasDuras(passos) > 1) return null;
  const passo = passoEsperado(passos, pararEm);
  return passo?.tipo === "dm" ? pararEm + 1 : pararEm;
}

// Quem está parado esperando o toque num botão pode ser interrompido por outra
// automação? Só quando duas coisas valem ao mesmo tempo.
//
// Veio de lib/engine.ts pelo mesmo motivo de `retomadaDoFallback`: é decisão
// pura, e decisão pura sem teste é onde os defeitos apareceram. Recebe só
// `{ id, match_type }` — o bastante para decidir, e nada que arraste o tipo
// `Automation` (lib/db.ts, `server-only`) para dentro deste arquivo.
//
// A PRIMEIRA é que a automação casada seja OUTRA. Comparar por id, e não só
// perguntar "casou com alguma?", é o ponto: quando a pessoa repete a palavra-
// chave da automação em que ela já está parada, isso não é pedido de outra
// coisa, é a mesma conversa continuando — e ela tem que retomar do cursor. Sem
// a comparação, esse caso caía no fluxo normal e reinterpretava a lista do
// índice 0: parava de novo na boas-vindas, regravava o cursor em 0 e não
// enfileirava nada, porque a boas-vindas do dia já estava na fila com a mesma
// `passoKey` e o `on conflict do nothing` engolia o item. Nenhuma mensagem
// saía, o cursor não andava, e cada nova mensagem repetia o mesmo nada — até
// virar o dia, quando a chave mudava de balde e a boas-vindas saía OUTRA VEZ
// para uma pessoa real, com o link ainda sem sair. Basta a pessoa repetir a
// palavra-chave para cair nisso, e a palavra-chave é justamente o que ela
// acabou de ler na boas-vindas.
//
// A SEGUNDA é que a automação nova NÃO seja `match_type: "any"`. A distinção é
// entre "pediu outra coisa" e "caiu na rede": palavra-chave específica é um
// pedido explícito — a pessoa digitou aquilo, e interromper é atendê-la. Já
// "Qualquer texto" não é escolha de ninguém, é rede de arrasto: casa com toda
// mensagem, de todo mundo, sempre. Se ela pudesse interromper, sequestraria
// todo contato parado no meio de qualquer outro fluxo, e ninguém chegaria ao
// link. Pega-tudo serve para quem não tem dono; quem está no meio de uma
// conversa já tem.
export function interrompeOFluxo(
  casada: { id: string; match_type: string } | undefined,
  parada: { id: string }
): boolean {
  if (!casada) return false;
  if (casada.id === parada.id) return false;
  return casada.match_type !== "any";
}
