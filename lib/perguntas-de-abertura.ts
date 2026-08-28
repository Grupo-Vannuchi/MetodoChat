// A REGRA DA META PARA AS PERGUNTAS DE ABERTURA, NUM LUGAR SÓ.
//
// As perguntas de abertura (ice breakers) são configuração da CONTA do
// Instagram: no máximo quatro para a conta inteira, e elas aparecem para quem
// abre a conversa pela primeira vez. Ler, escrever e apagar são três chamadas
// ao mesmo endpoint (`messenger_profile`), e o formato de cada uma foi
// EXERCITADO CONTRA A META por `scripts/perguntas-de-abertura.mjs` antes de
// existir tela nenhuma.
//
// POR QUE ELE SAIU DO SCRIPT PARA CÁ. A tela de Configuração precisa das
// mesmas três chamadas, e a segunda cópia da regra é a doença que esta base
// passou semanas curando (o id de bloco em três lugares, a forma da `dm` em
// três leitores, a regra do portão no motor e na varredura). O script continua
// existindo e continua sendo o caminho de linha de comando — ele agora IMPORTA
// daqui, e é por isso que este arquivo não tem NENHUM import: `node` roda o
// `.mjs` apagando os tipos deste `.ts`, e ele não resolve o atalho `@/` nem
// aguenta `server-only`.
//
// O QUE É PURO AQUI TEM TESTE (`tests/perguntas-de-abertura.test.ts`): os
// corpos das chamadas, a conferência do limite e a leitura da resposta. O que
// sobra é `fetch`, e ele não tem como ter teste puro.

// O LIMITE É DA CONTA INTEIRA, e é da Meta — não é escolha deste produto e não
// é por automação. Quem mostra isso a quem usa é a tela; quem o aplica antes de
// gastar uma chamada é `conferirPerguntas`, logo abaixo.
export const MAXIMO_DE_PERGUNTAS = 4;

// Uma pergunta como a Meta a guarda: o texto que a pessoa lê e o identificador
// que volta no postback quando ela toca. Quem transforma identificador em
// automação é `lerPayload` (lib/steps.ts) — deste lado ele é opaco de
// propósito, porque a Meta guarda o que estiver lá, inclusive o que foi escrito
// pelo painel dela.
export type Pergunta = { question: string; payload: string };

// A API "Instagram com Login do Instagram". `lib/ig.ts` tem a mesma base, e ela
// NÃO é importada aqui: aquele arquivo é `server-only` (o script não o carrega)
// e a base de lá passa por `baseDoGraph()`, que um teste de integração desvia
// para a própria máquina. Aqui não há teste para desviar, e o `access_token`
// viaja na query destas chamadas — uma base movível seria porta de saída de
// credencial sem nenhum teste a justificar.
export const BASE_DA_META = "https://graph.instagram.com/v25.0";

// O `locale` é OBRIGATÓRIO, e isso foi MEDIDO contra a API, não lido: sem ele a
// Meta responde 400, subcode 2534058 — "os conjuntos de chaves dos parâmetros
// de quebra-gelo devem ter o formato (question, payload) ou (call_to_actions,
// locale)". A forma sem `locale`, que é a que a DOCUMENTAÇÃO MOSTRA, não é
// aceita neste endpoint. Esta linha é o achado inteiro daquele experimento.
export const LOCALE = "default";

// O caminho é o mesmo nas três chamadas; o que muda é o método e o corpo.
function urlDoPerfil(igUserId: string, token: string, campos?: string): string {
  const q = new URLSearchParams({ access_token: token });
  if (campos) q.set("fields", campos);
  return `${BASE_DA_META}/${encodeURIComponent(igUserId)}/messenger_profile?${q}`;
}

// O corpo do POST. `platform: "instagram"` e o `locale` acima são o que separa
// esta chamada da que a documentação mostra.
export function corpoDeEscrita(perguntas: Pergunta[]): string {
  return JSON.stringify({
    platform: "instagram",
    ice_breakers: [{ locale: LOCALE, call_to_actions: perguntas }],
  });
}

// O corpo do DELETE. Ele apaga o CAMPO inteiro — não há como apagar uma
// pergunta só, e é por isso que a tela reescreve as quatro a cada gravação.
export function corpoDeApagar(): string {
  return JSON.stringify({ fields: ["ice_breakers"] });
}

// LISTA VAZIA NÃO É POST COM ZERO PERGUNTAS, É DELETE.
//
// Medido no formato do endpoint: `call_to_actions: []` é conjunto de chaves
// fora dos dois formatos aceitos, e a Meta recusa. Quem quer ficar sem pergunta
// nenhuma precisa apagar o campo. Sem esta decisão escrita, a tela que salva
// com todas as linhas em branco descobriria isso por um 400 da Meta.
export function acaoDaEscrita(perguntas: Pergunta[]): "apagar" | "escrever" {
  return perguntas.length === 0 ? "apagar" : "escrever";
}

// O QUE A META COME DO IDENTIFICADOR, E ISTO FOI MEDIDO EM 28/08/2026, NÃO LIDO.
//
// O endpoint `messenger_profile` responde `{"result":"success"}` e HTTP 200, e
// mesmo assim GUARDA A PERGUNTA SEM O `payload` quando ele tem certos
// caracteres. O toque naquela pergunta chega ao webhook sem identificador
// nenhum, e nada dispara — sem erro, sem log, sem nada em lugar algum.
//
// CONTROLE PAREADO, na conta de teste @saas.metodoia, mesma string trocando um
// caractere só:
//
//   payload "AUTO:436412ba-…"  ->  200 success  ->  a leitura de volta traz
//                                  {"question":"Controle"} — SEM payload
//   payload "AUTO-436412ba-…"  ->  200 success  ->  a leitura de volta traz
//                                  {"question":"Controle","payload":"AUTO-436412ba-…"}
//
// E o `|` é pior ainda, porque não some: ele TRUNCA. `AUTO|x` volta como
// `AUTO`, um identificador diferente do que se mandou.
//
// Outros medidos, e todos sobrevivem: `ab`, `AUTO_x`, `AUTO%3Ax` (o `%3A` fica
// literal, não vira dois-pontos), `abertura-saber-mais` — que é a forma das
// perguntas que estão em produção hoje.
//
// A CONSEQUÊNCIA É GRANDE E NÃO É DESTE MÓDULO RESOLVER: `payloadDaPergunta`
// (lib/steps.ts) emite `AUTO:<automação>`, e `lerPayload` exige o dois-pontos
// para reconhecê-lo. Enquanto essa forma for a forma, uma pergunta de abertura
// NÃO CONSEGUE apontar para automação nenhuma por este endpoint. O que este
// módulo faz é recusar antes: pôr no ar uma pergunta que não responde ao toque
// é pior que não pôr, porque ela aparece para TODA pessoa que abrir a conversa
// e o defeito só existe do lado de quem tocou.
export const CARACTERES_QUE_A_META_NAO_GUARDA = [":", "|"];

export function identificadorSobrevive(payload: string): boolean {
  return !CARACTERES_QUE_A_META_NAO_GUARDA.some((c) => payload.includes(c));
}

// A LEITURA DE VOLTA CONFERIDA CONTRA O QUE SE MANDOU.
//
// A guarda acima cobre o que foi MEDIDO; esta cobre o que não foi. Um 200 da
// Meta não é prova de nada — foi assim que o caso do dois-pontos apareceu —, e
// esta função é a diferença entre a tela dizer "salvo ✓" e a tela dizer o que
// de fato ficou no ar.
export function perguntasQueNaoFicaram(enviadas: Pergunta[], noAr: Pergunta[]): Pergunta[] {
  return enviadas.filter(
    (e) => !noAr.some((n) => n.question === e.question && n.payload === e.payload)
  );
}

// O QUE A META RECUSARIA, RECUSADO ANTES DA CHAMADA.
//
// Devolve `{ perguntas }` com o texto já aparado, ou `{ motivo }` em português
// de gente. Aceita zero perguntas de propósito: zero é um pedido legítimo, e
// quem traduz zero em DELETE é `acaoDaEscrita`.
export function conferirPerguntas(entrada: unknown): {
  perguntas?: Pergunta[];
  motivo?: string;
} {
  if (!Array.isArray(entrada)) return { motivo: "A lista de perguntas não chegou como lista." };
  if (entrada.length > MAXIMO_DE_PERGUNTAS) {
    return {
      motivo: `São no máximo ${MAXIMO_DE_PERGUNTAS} perguntas — o limite é da conta inteira, e é da Meta.`,
    };
  }
  const perguntas: Pergunta[] = [];
  for (const item of entrada) {
    const p = (item ?? {}) as Partial<Pergunta>;
    const question = typeof p.question === "string" ? p.question.trim() : "";
    const payload = typeof p.payload === "string" ? p.payload.trim() : "";
    // As duas metades são obrigatórias, e por motivos diferentes: sem texto a
    // pergunta aparece em branco na conversa de todo mundo que abrir; sem
    // identificador o toque não decide nada e a pessoa fica olhando para uma
    // pergunta que não responde.
    if (!question) return { motivo: "Toda pergunta precisa de um texto." };
    if (!payload) return { motivo: `A pergunta “${question}” está sem identificador.` };
    // MEDIDO: a Meta responde 200 e guarda a pergunta SEM o identificador (ver
    // `identificadorSobrevive`). Deixar passar poria no ar, para toda pessoa
    // que abrir a conversa, uma pergunta que não responde ao toque.
    if (!identificadorSobrevive(payload)) {
      return {
        motivo:
          `O identificador da pergunta “${question}” tem ${CARACTERES_QUE_A_META_NAO_GUARDA.map((c) => `“${c}”`).join(" ou ")}, ` +
          "e a Meta não guarda identificador com esses caracteres — ela aceita a chamada e devolve a pergunta sem ele. " +
          "A pergunta ficaria no ar sem disparar nada.",
      };
    }
    perguntas.push({ question, payload });
  }
  return { perguntas };
}

// A LEITURA DA RESPOSTA, E ELA É A VERDADE DA TELA.
//
// Forma MEDIDA contra a conta @vannuchi.eng em 28/08/2026:
//
//   {"data":[{"ice_breakers":[{"locale":"default","call_to_actions":[
//      {"question":"Quando começa a próxima turma?","payload":"abertura-proxima-turma"}, …]}]}]}
//
// DOIS FORMATOS SÃO ACEITOS, e não é defensividade à toa: a mensagem de erro
// 2534058 da própria Meta diz que os conjuntos válidos são `(question,
// payload)` OU `(call_to_actions, locale)`. Quem escreve pelo painel da Meta
// pode ter gravado o primeiro, e este produto não é o único que escreve neste
// campo — é justamente por isso que a tela lê da Meta em vez do banco.
//
// NÃO FILTRA POR `locale`. Este produto só escreve `default`, mas uma conta com
// perguntas traduzidas mostraria uma lista vazia se filtrasse, e "não tem
// pergunta nenhuma" é a pior mentira que esta tela pode contar: o dono
// acrescentaria a quinta e a Meta recusaria sem ele entender por quê.
export function perguntasDaResposta(json: unknown): Pergunta[] {
  const dados = ((json ?? {}) as { data?: unknown }).data;
  if (!Array.isArray(dados)) return [];
  const perguntas: Pergunta[] = [];
  for (const bloco of dados) {
    const quebras = ((bloco ?? {}) as { ice_breakers?: unknown }).ice_breakers;
    if (!Array.isArray(quebras)) continue;
    for (const q of quebras) {
      const entrada = (q ?? {}) as { call_to_actions?: unknown; question?: unknown; payload?: unknown };
      const lista = Array.isArray(entrada.call_to_actions) ? entrada.call_to_actions : [entrada];
      for (const item of lista) {
        const p = (item ?? {}) as { question?: unknown; payload?: unknown };
        if (typeof p.question !== "string" || typeof p.payload !== "string") continue;
        perguntas.push({ question: p.question, payload: p.payload });
      }
    }
  }
  return perguntas;
}

export type Leitura = { status: number; corpo: string; perguntas: Pergunta[] };
export type Efeito = { status: number; corpo: string; leitura: Leitura };

// A LEITURA DE VOLTA É O FIM DE TODO CAMINHO, inclusive o de escrita: um 200 do
// POST diz que a Meta aceitou a chamada, não que a conta ficou como se queria.
export async function lerPerguntas(igUserId: string, token: string): Promise<Leitura> {
  const r = await fetch(urlDoPerfil(igUserId, token, "ice_breakers"), { cache: "no-store" });
  const corpo = await r.text();
  let json: unknown = null;
  try {
    json = corpo ? JSON.parse(corpo) : null;
  } catch {
    // Resposta que não é JSON é resposta que não tem pergunta nenhuma para ler.
    // O `status` e o `corpo` seguem para quem chamou dizer o que aconteceu.
    json = null;
  }
  return { status: r.status, corpo, perguntas: r.ok ? perguntasDaResposta(json) : [] };
}

export async function escreverPerguntas(
  igUserId: string,
  token: string,
  perguntas: Pergunta[]
): Promise<Efeito> {
  const r = await fetch(urlDoPerfil(igUserId, token), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: corpoDeEscrita(perguntas),
  });
  const corpo = await r.text();
  return { status: r.status, corpo, leitura: await lerPerguntas(igUserId, token) };
}

export async function apagarPerguntas(igUserId: string, token: string): Promise<Efeito> {
  const r = await fetch(urlDoPerfil(igUserId, token), {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: corpoDeApagar(),
  });
  const corpo = await r.text();
  return { status: r.status, corpo, leitura: await lerPerguntas(igUserId, token) };
}

// O CAMINHO ÚNICO DE GRAVAÇÃO: confere, escolhe entre apagar e escrever, e lê
// de volta. É ele que a tela chama, e é ele que o script chama — para que a
// escolha "lista vazia vira DELETE" não precise ser lembrada em dois lugares.
export async function sincronizarPerguntas(
  igUserId: string,
  token: string,
  entrada: unknown
): Promise<{ efeito?: Efeito; motivo?: string }> {
  const { perguntas, motivo } = conferirPerguntas(entrada);
  if (!perguntas) return { motivo };
  return {
    efeito:
      acaoDaEscrita(perguntas) === "apagar"
        ? await apagarPerguntas(igUserId, token)
        : await escreverPerguntas(igUserId, token, perguntas),
  };
}
