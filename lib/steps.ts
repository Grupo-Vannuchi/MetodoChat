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
//
// `pos` é a posição no quadro, e ela é OPCIONAL pelo mesmo motivo: bloco
// gravado antes da Fase 1b não tem, e `arranjoAutomatico` (editor/modelos.ts)
// lhe dá uma na primeira abertura.
type ComId = { id?: string; pos?: Posicao };

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
//
// DOIS textos para a mesma falha, e não um, porque eles têm dois leitores.
//
// `motivo` é técnico e nomeia o campo: ele vai para os `ignorados` de
// `interpretar`, que são diagnóstico — quem os lê está atrás do defeito e
// conhece o código.
//
// `paraODono` é a mesma falha na língua de quem monta a automação, e é o que
// `conferirLista` mostra na tela. Antes a tela mostrava o `motivo` cru, e o dono
// do painel lia "Bloco incompleto: pedir_email sem texto." — nome de tipo
// interno, num painel em que todo o resto fala de "pedido de e-mail".
//
// Os dois saem do MESMO `return` de propósito. Numa tabela à parte, ligada por
// chave, uma falha nova ganharia entrada de um lado e não do outro, e a tela
// voltaria a vazar jargão — ou pior, mostraria a frase de outra falha.
function conferir(p: unknown): { passo?: Passo; motivo?: string; paraODono?: string } {
  if (!p || typeof p !== "object") {
    return {
      motivo: "passo não é um objeto",
      paraODono: "Este bloco está corrompido e não vai ser enviado.",
    };
  }
  const o = p as Record<string, unknown>;
  const tipo = o.tipo;

  if (tipo === "dm") {
    if (typeof o.texto !== "string" || !o.texto.trim()) {
      return { motivo: "dm sem texto", paraODono: "Esta mensagem está sem texto." };
    }
    return { passo: p as Passo };
  }
  if (tipo === "esperar") {
    if (typeof o.minutos !== "number" || !Number.isFinite(o.minutos) || o.minutos < 0) {
      return {
        motivo: "esperar com minutos inválido",
        paraODono: "Esta espera está sem um tempo válido em minutos.",
      };
    }
    return { passo: p as Passo };
  }
  if (tipo === "resposta_publica") {
    if (!Array.isArray(o.textos) || !o.textos.length) {
      return {
        motivo: "resposta pública vazia",
        paraODono: "Esta resposta pública não tem nenhum texto para publicar.",
      };
    }
    return { passo: p as Passo };
  }
  if (tipo === "reagir_story") {
    if (typeof o.emoji !== "string" || !o.emoji) {
      return { motivo: "reagir_story sem emoji", paraODono: "Este coraçãozinho está sem emoji." };
    }
    return { passo: p as Passo };
  }
  if (tipo === "pedir_follow") {
    if (typeof o.texto !== "string" || !o.texto.trim()) {
      return {
        motivo: "pedir_follow sem texto",
        paraODono: "Este pedido de follow está sem texto.",
      };
    }
    return { passo: p as Passo };
  }
  if (tipo === "pedir_email") {
    if (typeof o.texto !== "string" || !o.texto.trim()) {
      return {
        motivo: "pedir_email sem texto",
        paraODono: "Este pedido de e-mail está sem texto.",
      };
    }
    return { passo: p as Passo };
  }
  return {
    motivo: `tipo desconhecido: ${String(tipo)}`,
    paraODono: "Este bloco é de um tipo que o sistema não reconhece e não vai ser enviado.",
  };
}

// A forma do id, e por que ela é conferida em vez de aceita.
//
// A identidade entra na `dedupe_key`. Um id como "2" colidiria com a chave por
// índice de um OUTRO bloco — a chave é a mesma string —, e colisão em
// `dedupe_key` não dá erro: o `on conflict do nothing` engole o segundo item e
// a pessoa deixa de receber uma mensagem, sem nada aparecer em lugar nenhum.
// O prefixo `b_` torna isso impossível por construção.
const FORMA_DO_ID = /^b_[0-9a-z]{6,}$/;

// O id de um bloco novo, e ele mora AQUI, coladinho na forma que o valida.
//
// Ele já existiu em três cópias — `app/automacoes/actions.ts`,
// `app/automacoes/editor/modelos.ts` e `scripts/dar-ids-aos-passos.mjs` —, e as
// três carregavam o MESMO defeito: `Math.random().toString(36).slice(2, 10)`
// devolve menos de 6 caracteres quando o sorteio cai num número de
// representação curta (0.5 vira "0.i", e a fatia sai com 1 caractere). Aí
// `FORMA_DO_ID` recusa o id, `identidadeDoPasso` cai no ÍNDICE, e desde a
// Tarefa 4 `conferirLista` acende "identidade inválida" e TRAVA O SALVAR de uma
// automação que a pessoa acabou de montar. Nada disso é cosmético, e sortear
// menos que 6 caracteres é raro, não impossível: é o modo de falhar que só
// aparece em produção, num cliente, uma vez.
//
// Duas cópias viravam dois consertos, e é por isso que agora é uma só. O
// alfabeto é escrito à mão e o comprimento é FIXO em 8: `toString(36)` amarra o
// tamanho da saída à representação decimal do sorteio, e é essa amarra que
// produzia o id curto. Aqui não há o que torcer — 8 caracteres sempre, todos
// dentro do `[0-9a-z]` que `FORMA_DO_ID` exige.
//
// A terceira cópia, a do script `.mjs`, continua sendo uma cópia porque o script
// é JavaScript solto e não importa TypeScript (o motivo está escrito lá, junto
// do regex que ele também repete). Ela foi corrigida do mesmo jeito, e o
// comentário de lá aponta para cá.
//
// Curto de propósito: o id entra na `dedupe_key`, que é uma coluna UNIQUE
// consultada a cada envio. 36^8 é aleatoriedade de sobra para não colidir dentro
// de UMA automação, que é o único escopo em que ele precisa ser único — tudo que
// o consome já é qualificado pelo id da automação.
const ALFABETO_DO_ID = "0123456789abcdefghijklmnopqrstuvwxyz";

export function novoIdDeBloco(): string {
  let id = "b_";
  for (let i = 0; i < 8; i++) {
    id += ALFABETO_DO_ID[Math.floor(Math.random() * ALFABETO_DO_ID.length)];
  }
  return id;
}

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

// ---------------------------------------------------------------------------
// A REGRA DO PORTÃO, e ela é UMA SÓ: as três funções de retomada abaixo terminam
// nela.
//
//   NINGUÉM ATRAVESSA UM PORTÃO SEM ELE SER AVALIADO, E VENCER O PORTÃO NÃO
//   CUSTA O RESTO DO FLUXO.
//
// O portão é PONTO DE PASSAGEM. Quando o destino decidido cai DEPOIS de um
// `pedir_follow`, o fluxo atravessa esse portão primeiro e, vencido, continua
// para o DESTINO ORIGINAL — não para o passo seguinte ao portão.
//
// POR QUE A REGRA EXISTE, com as duas entradas medidas. Até a Fase 1b toda `dm`
// de resposta rápida da lista vinha ANTES do portão, porque era o formulário que
// montava a lista: uma resposta rápida só, a boas-vindas, e ela é a primeira. O
// quadro de blocos livres acaba com essa garantia, e o `+1` das retomadas soma
// sobre a POSIÇÃO, não sobre o tipo — some a garantia, e ele passa a cair do
// outro lado do portão.
//
//   [portão, boas-vindas(resposta rápida), link] — reordenação que o quadro
//     permite. Quem está parado na boas-vindas manda um texto qualquer, o ramo
//     de texto retoma do `indiceParado + 1`, que é o LINK, e o portão nunca foi
//     avaliado.
//   [resposta rápida, portão, resposta rápida, link] — o toque no botão do
//     bloco 2 retoma do 3, que é o link, pelo mesmo `+1` e pelo mesmo motivo.
//
// Nos dois, o link — a promessa central do produto — sai para quem não segue.
//
// POR QUE O DESTINO É PRESERVADO, e não `portão + 1`. Esta é a metade que custou
// uma rodada de medição, e ela não é detalhe de forma: `portão + 1` REINTERPRETA
// a lista e para na primeira parada dura do caminho. Na segunda lista acima,
// essa parada é a PRÓPRIA resposta rápida do índice 2 — vencido o portão,
// `interpretar(2)` para nela de novo e regrava o cursor ali; o toque seguinte
// repete o ciclo inteiro. Para sempre, e não para uma pessoa: para TODAS, porque
// o ramo de texto clampa igual e não sobra saída nenhuma. O bloco 3 deixaria de
// ser entregue a todo mundo.
//
// Preservando o destino isso some, e some junto o outro preço: `interpretar`
// começa em `destino`, então NADA entre o portão e o destino é reenfileirado. A
// regra não cobra mensagem repetida de ninguém.
//
// `portao < destino` é a comparação inteira, e os dois limites importam:
//
//   IGUAL não é passagem. Quem está parado NO portão retoma DELE, e
//     `interpretar` o encontra sozinho no primeiro passo que lê. Marcar
//     passagem aqui faria `resolverFollow` consultar a Meta duas vezes no mesmo
//     toque, e a segunda consulta decidiria sobre um portão já decidido.
//   DEPOIS não é passagem pelo mesmo motivo: portão adiante do destino está no
//     caminho que `interpretar` vai percorrer, e ele para nele como sempre.
//
// COM MAIS DE UM PORTÃO atravessa-se o PRIMEIRO, porque é o que `indiceDoPortao`
// devolve, e isso basta: o que um portão pergunta — "esta pessoa segue o perfil?"
// — é a mesma pergunta em todos eles, e `resolverFollow` não distingue um do
// outro. O que muda é só o TEXTO do pedido enviado a quem é barrado, que será o
// do primeiro. Lista com dois portões já é ERRO em `conferirLista`, e o resto do
// preço está escrito no comentário de `indiceDoPortao`.
// ---------------------------------------------------------------------------
export type Retomada = {
  // O portão a atravessar antes, ou null quando não há nenhum no caminho.
  portao: number | null;
  // Onde o fluxo continua — depois de vencer o portão, ou direto se não há.
  destino: number;
};

function atravessandoOPortao(passos: unknown, destino: number): Retomada {
  const portao = indiceDoPortao(passos);
  return { portao: portao !== null && portao < destino ? portao : null, destino };
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
//     ISSO NÃO BASTAVA para garantir que o `+1` (abaixo) nunca pulasse um
//     portão: ele soma sobre a POSIÇÃO do bloco na lista, não sobre o tipo
//     dele. A conta só fechava ENQUANTO TODA `dm` de resposta rápida da lista
//     viesse ANTES de qualquer portão — é o que o formulário garante (uma só, e
//     é a boas-vindas, que vem primeiro) e o que o quadro de blocos livres NÃO
//     garante. Havendo uma `dm` de resposta rápida DEPOIS de um portão, o `+1`
//     caía depois dele e o portão não era reavaliado.
//
//     Quem fecha isso agora é a REGRA DO PORTÃO (`atravessandoOPortao`, acima),
//     e ela fecha pela POSIÇÃO, que é onde o buraco estava: o destino continua
//     sendo o `+1`, e o portão que ficou para trás vira ponto de passagem.
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
): Retomada {
  const id = cursorDesta(cursor, automationId);
  const indice = id === null ? null : indiceDoId(passos, id);
  if (indice === null) return atravessandoOPortao(passos, 0);
  const tipo = passoEsperado(passos, indice)?.tipo;
  const destino = tipo === "pedir_follow" || tipo === "pedir_email" ? indice : indice + 1;
  return atravessandoOPortao(passos, destino);
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
): Retomada {
  const id = cursorDesta(cursor, automationId);
  const indice = id === null ? null : indiceDoId(passos, id);
  return atravessandoOPortao(passos, indice ?? indiceDoPortao(passos) ?? 0);
}

// De qual passo o TEXTO SOLTO de quem está parado num passo de espera retoma.
//
// O QUARTO ponto de retomada, e o último a mudar de casa. Ele era uma expressão
// solta em lib/engine.ts — `passo.tipo === "pedir_follow" ? indiceParado :
// indiceParado + 1` —, calculada por conta própria, sem passar por nenhuma das
// outras três. Expressão de controle de fluxo dentro de `server-only` é
// exatamente a classe de código que o comentário de `cursorDaRetomada` (acima)
// descreve como a que nenhum teste alcança, e nesta branch já saíram três de lá
// pelo mesmo motivo. Esta é a quarta.
//
// E ela não vem de graça: é por ELA que a primeira das duas entradas da regra do
// portão é alcançável. Com a lista reordenada para `[portão, boas-vindas, link]`,
// quem está parado na boas-vindas e manda qualquer texto caía em `+1` = o link,
// com o portão nunca avaliado. Enquanto o cálculo morasse no motor, a regra
// escrita aqui não o alcançaria.
//
// O `indice` que chega é o do bloco em que a pessoa está parada, já resolvido
// por `indiceDoId` e já confirmado por `passoEsperado` lá no motor — este ramo
// só é alcançado quando há um passo de espera de verdade naquele índice. A
// releitura do tipo aqui dentro é de propósito: a decisão fica INTEIRA numa
// função com teste, em vez de metade aqui e metade no argumento que o motor
// escolhe passar.
//
// A regra por tipo é a mesma dos outros ramos, e o motivo também:
//
//   `pedir_follow` → retoma DELE MESMO. A mensagem de texto não é o follow, e
//     avançar entregaria o link a quem não segue — bastaria mandar "ok".
//   `pedir_email` → retoma do SEGUINTE, e aqui a diferença em relação ao
//     `AUTO:` é real: o motor acabou de EXTRAIR o e-mail desta mensagem e
//     gravá-lo em `contacts.email`. O pedido foi atendido; repeti-lo seria pedir
//     de novo o que a pessoa acabou de mandar.
//   `dm` de resposta rápida → retoma do SEGUINTE. O texto vale como resposta,
//     do mesmo jeito que no fallback.
export function retomadaDoTexto(passos: unknown, indice: number): Retomada {
  const tipo = passoEsperado(passos, indice)?.tipo;
  return atravessandoOPortao(passos, tipo === "pedir_follow" ? indice : indice + 1);
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
//
// ESTA É A ÚNICA DAS QUATRO RETOMADAS QUE NÃO RECEBE A REGRA DO PORTÃO
// (`atravessandoOPortao`, acima), e continua devolvendo um número. Não é
// esquecimento: a regra é INALCANÇÁVEL aqui, por construção, e a demonstração
// cabe em três linhas.
//
// Ela parte de `interpretar(passos, 0)`, que para no PRIMEIRO passo que espera
// resposta. `pedir_follow` espera resposta. Logo, se houvesse um portão ANTES de
// `pararEm`, `interpretar` teria parado NELE — nenhum portão precede `pararEm`.
// E o `+1` do ramo `dm` cai no máximo sobre a posição do portão que vier logo
// depois, nunca depois dele: `portao < destino` seria falso em toda entrada
// possível.
//
// Aplicá-la assim mesmo seria escrever uma linha que nenhum teste consegue
// cobrir — e linha não coberta dentro de decisão de fluxo é onde esta base já
// escondeu defeito duas vezes. O teste "a regra não muda nada no fallback"
// (tests/steps.test.ts) fixa a demonstração, para ela não deixar de valer em
// silêncio se `interpretar` mudar de comportamento.
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

export type Problema = {
  nivel: "erro" | "aviso";
  // Qual bloco. Null quando o problema é da lista inteira.
  indice: number | null;
  mensagem: string;
};

// Os três tipos de que a lista só pode ter UM, e o motivo de cada um.
//
// A regra é a mesma dos dois portões de follow — bloquear o que o motor
// engoliria em silêncio —, mas o MECANISMO não é o mesmo nos três, e a mensagem
// precisa dizer o certo porque é ela que o dono lê para decidir o que fazer com
// o bloco.
//
// `reagir_story` e `resposta_publica`: é a CHAVE de deduplicação, e ela não
// conhece o bloco. `storyReactionKey(mid)` é a mesma string para as duas
// reações à mesma story, `commentReplyKey(comment_id)` a mesma para as duas
// respostas ao mesmo comentário (lib/dedupe.ts), e o `on conflict do nothing`
// do enqueue engole o segundo item sem erro nenhum.
//
// `pedir_email`: quem engole o segundo é o próprio MOTOR, antes de a chave
// entrar em jogo. O ramo `pedir_email` de lib/engine.ts pula o bloco quando o
// e-mail do contato já é conhecido (`if (rows[0]?.email) return
// executarFluxo(..., acao.indice + 1, ...)`), e depois de o primeiro pedido ser
// respondido o endereço já está gravado — então o segundo normalmente nem chega
// a ser enfileirado. `emailAskKey(auto, pessoa, dia)` só decide no caso restante:
// os dois enfileirados no mesmo dia sem que o e-mail tenha sido respondido entre
// eles. Aí sim a chave, igual para os dois, é quem engole o segundo.
//
// `passoKey` ganhou a identidade do bloco na Tarefa 1; estas três não. A regra
// sai daqui no dia em que ganharem. `followGateKey` tem o mesmo buraco e não
// precisa de entrada própria: o bloqueio dos dois portões já o torna
// inalcançável pelo editor.
const SO_UM_POR_LISTA: Record<string, string> = {
  pedir_email:
    "Só pode haver um pedido de e-mail. O segundo nunca é entregue: quando o endereço já foi respondido, o motor pula o bloco; quando não foi, ele sai com a mesma chave de envio do primeiro.",
  reagir_story:
    "Só pode haver uma reação à story. A segunda sai com a mesma chave de envio da primeira, e por isso nunca é entregue.",
  resposta_publica:
    "Só pode haver uma resposta pública. A segunda sai com a mesma chave de envio da primeira, e por isso nunca é entregue.",
};

// Confere a lista montada no quadro.
//
// Roda em DOIS lugares: no navegador, para desabilitar o salvar e dizer por
// quê; e no Server Action, porque nada vindo do navegador é confiável. É por
// isso que ela mora aqui e é pura — escrever a regra duas vezes é como as duas
// versões passam a discordar.
//
// ERRO trava o salvar; AVISO explica e deixa passar. A linha entre os dois foi
// decidida com o dono do produto: trava o que o motor não consegue executar
// como montado, e avisa o que é incomum mas coerente.
//
// `esperar` com `minutos: 0` NÃO entra aqui, e isso é DECISÃO, não esquecimento:
// uma espera de zero minutos não atrasa nada, mas também não quebra nada, e o
// aviso de "espera no fim da lista" (mais abaixo) já pega o caso em que ela é
// de fato inútil. Um erro ou aviso aqui, sobre o valor em si, seria ruído.
export function conferirLista(passos: unknown, gatilho: string): Problema[] {
  const r: Problema[] = [];

  // Os dois motivos são separados porque as causas são diferentes: aqui a
  // coluna está quebrada; abaixo ela está íntegra e o conteúdo é que falta. É a
  // mesma distinção que `interpretar` faz nos seus `ignorados`.
  if (!Array.isArray(passos)) {
    return [{ nivel: "erro", indice: null, mensagem: "A automação não tem lista de blocos." }];
  }
  if (!passos.length) {
    return [
      { nivel: "erro", indice: null, mensagem: "Sem nenhum bloco, a automação não envia nada." },
    ];
  }

  let portoes = 0;
  // Guarda o ÍNDICE do primeiro link antes do portão, não só se existe um.
  // Sem o índice, o aviso não tinha onde acender — `Problema.indice` ficava
  // `null` e o editor (Tarefa 5) não tinha como destacar o bloco culpado.
  let indiceDoLinkAntesDoPortao: number | null = null;
  const jaVistos = new Set<string>();
  const idsVistos = new Set<string>();

  for (let i = 0; i < passos.length; i++) {
    const { passo, paraODono } = conferir(passos[i]);

    // Bloco inválido é ignorado pelo interpretador — quem montou acha que
    // mandou e não mandou. É a falha mais silenciosa que existe aqui.
    //
    // A mensagem é a do DONO, não o `motivo` técnico: esta lista é lida na tela
    // por quem monta a automação. O `motivo` continua saindo, para diagnóstico,
    // nos `ignorados` de `interpretar`, que é onde alguém atrás do defeito olha.
    if (!passo) {
      r.push({ nivel: "erro", indice: i, mensagem: paraODono! });
      continue;
    }

    // Bloco que não pode disparar naquele gatilho. A paleta não o oferece, mas
    // lista vinda de fora do editor pode trazê-lo.
    //
    // AS DUAS METADES TÊM MECANISMOS DIFERENTES, e por isso níveis diferentes.
    // Elas já estiveram sob uma afirmação só — "bloco que não pode disparar
    // naquele gatilho nunca roda" —, e essa afirmação só era verdade para uma.
    //
    // `resposta_publica` precisa do id do COMENTÁRIO, e só o gatilho de
    // comentário o conhece: `handleComment` (lib/engine.ts) chama `executarFluxo`
    // com `{ commentId }`, e nenhum outro caminho o preenche. O ramo
    // `resposta_publica` de `enfileirarPasso` faz `if (!contexto.commentId)
    // return`. Em qualquer outro gatilho o bloco NUNCA roda, e travar o que o
    // motor não consegue executar é exatamente o que ERRO quer dizer aqui.
    //
    // `reagir_story` precisa do id da MENSAGEM, e DOIS gatilhos o fornecem. É o
    // mesmo `handleMessage` (lib/engine.ts) que atende a resposta de story e a
    // DM comum — `const trigger = isStoryReply ? "story" : "dm"` decide só qual
    // automação casa —, e ele chama `executarFluxo(..., { messageId: msg.mid })`
    // nos dois. `enfileirarPasso` não exige mais nada, e `lib/queue-drain.ts`
    // entrega: o comentário de lá diz literalmente "reação na mensagem que a
    // pessoa mandou". No gatilho `dm` o coraçãozinho RODA, então travar o salvar
    // travaria uma lista que o motor executa — é AVISO, e o texto diz o que vai
    // acontecer de fato, porque é incomum e o dono pode ter querido outra coisa.
    //
    // No gatilho de comentário não há mensagem nenhuma a que reagir, e aí o
    // bloco volta a nunca rodar: ERRO, pelo mesmo critério da metade de cima.
    if (passo.tipo === "reagir_story" && gatilho === "dm") {
      r.push({
        nivel: "aviso",
        indice: i,
        mensagem:
          "Neste gatilho o coraçãozinho não vai para a story: ele reage à mensagem que a pessoa mandou.",
      });
    }
    if (passo.tipo === "reagir_story" && gatilho !== "dm" && gatilho !== "story") {
      r.push({
        nivel: "erro",
        indice: i,
        mensagem:
          "O coraçãozinho precisa de uma mensagem para reagir, e neste gatilho não chega nenhuma.",
      });
    }
    if (passo.tipo === "resposta_publica" && gatilho !== "comment") {
      r.push({
        nivel: "erro",
        indice: i,
        mensagem: "A resposta pública só funciona no gatilho de comentário.",
      });
    }

    // Resposta pública com todos os textos em branco não é publicada, e o motor
    // documenta isso: `enfileirarPasso` (lib/engine.ts) sorteia um dos textos e
    // faz `if (!texto?.trim()) return` — sem enfileirar, sem `step_ignorado`,
    // sem nada em Atividade. `conferir`, acima, só exige que a lista não esteja
    // VAZIA, então `{textos:[""]}` passa por ela inteira.
    //
    // Basta UM texto aproveitável para a regra calar, e isso é deliberado: com
    // uma mistura de textos cheios e vazios o sorteio às vezes cai no vazio e a
    // resposta some naquela vez. É perda real, mas é intermitente e não trava
    // nada — travar o salvar por causa dela recusaria lista que funciona na
    // maioria dos disparos. Fica registrado aqui para quem quiser transformá-lo
    // num aviso próprio depois.
    if (
      passo.tipo === "resposta_publica" &&
      !passo.textos.some((t) => typeof t === "string" && t.trim())
    ) {
      r.push({
        nivel: "erro",
        indice: i,
        mensagem:
          "Esta resposta pública está em branco, e por isso não é publicada: o motor sorteia um dos textos e desiste quando ele não tem nada escrito.",
      });
    }

    // A IDENTIDADE DO BLOCO, e por que ela é conferida aqui.
    //
    // Esta validação existe porque o `id` PASSA A VIR DE FORA. Até a Tarefa 6 só
    // `montarPassos` e o script de migração o produziam, os dois com
    // `novoIdDeBloco()`, e a forma era certa por construção. A partir dela o id
    // é montado no NAVEGADOR e chega pelo Server Action — e nada vindo do
    // navegador é confiável. `conferirLista` é a única validação do lado do
    // servidor, então o que ela não pegar não é pego por ninguém.
    //
    // O que quebra nos dois casos é a `dedupe_key`, e ela quebra CALADA: o `on
    // conflict do nothing` do enqueue engole o item repetido sem erro nenhum, e
    // a pessoa deixa de receber uma mensagem sem que nada apareça em lugar
    // nenhum.
    //
    // ID REPETIDO: dois blocos com o mesmo id têm a mesma `passoKey`, e o
    // segundo envio some. Duplicar um bloco no editor é exatamente o gesto que
    // produz isso, e é um gesto que o quadro vai oferecer.
    //
    // ID FORA DA FORMA: `identidadeDoPasso` recusa o id e cai no ÍNDICE, e aí a
    // chave colide com a de outro bloco que também esteja sem id válido — a
    // colisão que `FORMA_DO_ID` foi criada para tornar impossível. Um id "2" é
    // a mesma string que o índice 2 de um bloco vizinho.
    //
    // SEM `id` NENHUM não é erro, e isso é decisão. Bloco sem id é o que toda
    // automação anterior à Fase 1b tem gravado, e `identidadeDoPasso` lhe dá a
    // identidade que ele sempre teve na prática, o índice. Recusá-lo trancaria o
    // dono fora do painel de toda lista antiga — o mesmo estrago que a condição
    // pela metade do link sem endereço causou.
    const idBruto = (passos[i] as { id?: unknown }).id;
    if (idBruto !== undefined) {
      if (typeof idBruto !== "string" || !FORMA_DO_ID.test(idBruto)) {
        r.push({
          nivel: "erro",
          indice: i,
          mensagem:
            "Este bloco tem uma identidade inválida. Ela é o que separa um envio do outro, e com essa identidade uma das mensagens da automação deixa de ser entregue, sem aviso.",
        });
      } else if (idsVistos.has(idBruto)) {
        r.push({
          nivel: "erro",
          indice: i,
          mensagem:
            "Dois blocos têm a mesma identidade. Só o primeiro é entregue — o segundo é descartado no envio, sem aviso.",
        });
      } else {
        idsVistos.add(idBruto);
      }
    }

    if (passo.tipo === "pedir_follow") {
      portoes++;
      if (portoes > 1) {
        r.push({
          nivel: "erro",
          indice: i,
          mensagem:
            "Só pode haver um pedido de follow. Com dois, o botão “Já sigo!” não sabe a qual voltar.",
        });
      }
    }

    // Aponta o SEGUNDO, não o primeiro: o primeiro é o que vai ser entregue, e
    // é o segundo que o dono precisa apagar ou trocar de lugar.
    const soUm = SO_UM_POR_LISTA[passo.tipo];
    if (soUm) {
      if (jaVistos.has(passo.tipo)) r.push({ nivel: "erro", indice: i, mensagem: soUm });
      jaVistos.add(passo.tipo);
    }

    // "Mensagem com link" (Tarefa 5) semeia SEMPRE a chave `url`, mesmo vazia
    // — é a convenção que o editor tem que manter para esta regra funcionar.
    // "Mensagem" e "Mensagem com botão" NUNCA gravam essa chave.
    //
    // O MECANISMO por inteiro: um bloco `dm_link` sem endereço salva
    // `{tipo:"dm", texto, botao_label:"Abrir link", url:""}`. `esperaResposta`
    // faz `Boolean(botao_label) && !url` — `""` é falso, então `!url` é
    // verdadeiro — e o bloco vira resposta rápida aos olhos do motor: o fluxo
    // ENFILEIRA esse passo e PARA nele, esperando o toque num botão que não
    // tem endereço nenhum para abrir. É parada dura, calada, para sempre — o
    // mesmo defeito que a fase anterior registrou (lembrete salvo sem link).
    //
    // A CONDIÇÃO ESPELHA `esperaResposta`, e ela tem que espelhá-la INTEIRA. A
    // versão anterior conferia só o `!url` e deixava o `botao_label` de fora —
    // metade do mecanismo —, e por isso recusava uma DM comum que funciona.
    // São três partes, e cada uma exclui uma forma legítima:
    //
    //   `botao_label` PRESENTE — é o que faz `esperaResposta` dizer sim, e sem
    //     ele não há parada dura nenhuma a acusar: `{tipo:"dm", texto, url:""}`
    //     sem rótulo é DM comum, o fluxo passa por ela e segue. Sem esta parte
    //     o dono ficava TRANCADO FORA do painel, e por um caminho que a tela
    //     oferece: o painel da Tarefa 7 mostra o campo do rótulo sempre que
    //     `botao_label !== undefined` e deixa apagá-lo, então bloco de link
    //     criado pela paleta, rótulo apagado e endereço ainda vazio dava ERRO
    //     numa lista sem nada de errado, e o salvar ficava bloqueado.
    //
    //   `url` DIFERENTE de `undefined` — e esta parte é a que não se enxerga
    //     olhando só o banco. A saída EM MEMÓRIA de `montarPassos`
    //     (app/automacoes/actions.ts) grava `url: fu.url || undefined`: a chave
    //     ESTÁ presente, com valor `undefined`, e o `undefined` só some no
    //     `JSON.stringify` que serializa para o jsonb. Conferir a chave por
    //     `"url" in passo` dava `true` nela, e qualquer
    //     `conferirLista(montarPassos(...))` chamado ANTES de serializar
    //     recusaria toda automação sem link. Testar contra `undefined` cobre de
    //     uma vez esse caso e o do bloco sem a chave — em `{tipo:"dm", texto,
    //     botao_label}` a leitura de `passo.url` também dá `undefined`.
    //
    //   `url` FALSY — o bloco com endereço não tem o que ser acusado.
    //
    // ISTO SÓ VALE enquanto o editor mantiver a convenção. Se ele passar a
    // semear `url` (mesmo vazia) num bloco de resposta rápida, todo bloco
    // desse tipo passaria a acender este erro à toa; se ele apagar a chave de
    // um `dm_link` sem endereço, esta regra deixa de disparar em silêncio e o
    // defeito volta a passar batido.
    //
    // E A REGRA É CEGA PARA A FORMA QUE JÁ ESTÁ GRAVADA, o que precisa estar
    // dito porque é justamente o defeito que ela existe para pegar. O
    // `montarPassos` da `main` grava `url: fu.url || undefined`, e o `undefined`
    // some na serialização: o que ficou no banco de quem salvou um link sem
    // endereço é `{tipo:"dm", texto, botao_label:"Abrir link"}` — rótulo, SEM a
    // chave. É parada dura de verdade, e `conferirLista` devolve `[]` para ela.
    //
    // Não há heurística a inventar aqui, e a ausência dela é decisão: esse bloco
    // é GENUINAMENTE ambíguo. A mesma forma exata — rótulo, sem chave `url` — é
    // o bloco de resposta rápida legítimo que a paleta oferece, e nada no dado
    // separa os dois. Adivinhar erraria em cima de listas boas.
    //
    // Esta regra vale, portanto, para lista NOVA, montada sob a convenção. O que
    // fazer com o que o formulário antigo gravou é decisão de quem ABRE a
    // automação no editor (Tarefa 5), onde há a quem perguntar; está registrada
    // no plano, junto do requisito da convenção.
    if (
      passo.tipo === "dm" &&
      Boolean(passo.botao_label) &&
      passo.url !== undefined &&
      !passo.url
    ) {
      r.push({
        nivel: "erro",
        indice: i,
        mensagem:
          "Mensagem com link sem endereço trava o fluxo para sempre: ele para aqui esperando o toque num botão que não leva a lugar nenhum.",
      });
    }

    if (
      passo.tipo === "dm" &&
      passo.url &&
      portoes === 0 &&
      indiceDoLinkAntesDoPortao === null
    ) {
      indiceDoLinkAntesDoPortao = i;
    }
  }

  // Sem portão nenhum não há o que avisar: o link chegar a quem não segue é o
  // que a automação faz, não um descuido de ordem.
  if (indiceDoLinkAntesDoPortao !== null && portoes > 0) {
    r.push({
      nivel: "aviso",
      indice: indiceDoLinkAntesDoPortao,
      mensagem:
        "O link sai antes do pedido de follow, então quem não segue recebe o link mesmo assim. O portão só segura o que vier depois dele.",
    });
  }

  const ultimo = conferir(passos[passos.length - 1]).passo;
  if (ultimo?.tipo === "esperar") {
    r.push({
      nivel: "aviso",
      indice: passos.length - 1,
      mensagem: "Não há nenhum bloco depois desta espera, então ela não atrasa nada.",
    });
  }

  return r;
}
