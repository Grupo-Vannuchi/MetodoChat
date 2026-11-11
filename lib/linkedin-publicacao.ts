// AS DECISÕES PURAS DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §5), SEM IMPORT DE SERVIDOR: a
// tela de cliente e o servidor leem as mesmas regras. Na parte 1 (a conexão), o vencimento; na parte 2a (só
// texto e imagem, uma rede por post), as formas, o texto, o payload da fila, o corpo do post e os erros. O
// carrossel em PDF e o vídeo vêm na parte 3.

/** O aviso de que a autorização vai vencer começa a 7 dias. */
export const AVISO_DO_VENCIMENTO_DIAS = 7;

const DIA_MS = 86_400_000;

export type Vencimento = { estado: "valido" | "perto" | "vencido"; dias: number; frase: string };

/**
 * O VENCIMENTO DA AUTORIZAÇÃO DO LINKEDIN: 60 dias, sem renovação automática (renovar é mandar um convite
 * novo). Um pedaço de dia conta como um dia inteiro, e o prazo vence no próprio instante, como o do convite
 * (`estadoDoConvite`, lib/convites.ts). A data pode chegar como texto, de um componente de cliente.
 */
export function vencimentoDoLinkedin(expiraEm: Date | string, agoraMs: number): Vencimento {
  const falta = new Date(expiraEm).getTime() - agoraMs;
  if (!(falta > 0)) return { estado: "vencido", dias: 0, frase: "venceu" };
  const dias = Math.ceil(falta / DIA_MS);
  return {
    estado: dias <= AVISO_DO_VENCIMENTO_DIAS ? "perto" : "valido",
    dias,
    frase: dias === 1 ? "vence em 1 dia" : `vence em ${dias} dias`,
  };
}

/**
 * O CONVITE NUMA CONTA QUE JÁ TEM O LINKEDIN PEDE CONFIRMAÇÃO (a decisão do Eduardo pela caixa, 10/11, 17:16:36Z:
 * "Pede confirmação antes"; o achado 209). Um convite novo, quando usado, troca a conexão que existe. Sem LinkedIn,
 * ou com ele vencido, não há o que trocar. A tela pede, e o servidor recusa sem a confirmação, pela mesma regra.
 */
export function oConvitePedeConfirmacao(estado: Vencimento["estado"] | null): boolean {
  return estado === "valido" || estado === "perto";
}

export function textoDaConfirmacaoDoConvite(nome: string): string {
  return `Esta conta já tem o LinkedIn de ${nome} conectado. Um convite novo, quando usado, troca essa conexão pela nova. Gerar o convite mesmo assim?`;
}

export const TEXTO_DO_CONVITE_SEM_CONFIRMACAO =
  "Esta conta já tem o LinkedIn conectado: confirme antes de gerar um convite novo.";

// ---------------------------------------------------------------------------------------------------------------
// AS FORMAS DA PARTE 2a
// ---------------------------------------------------------------------------------------------------------------

export type FormaNoLinkedin = "texto" | "imagem";

/**
 * AS FORMAS QUE ESTE CÓDIGO SABE PUBLICAR NO LINKEDIN, numa lista só: a do formulário, a do payload e a do dreno
 * (`soAFormaConhecidaDoLinkedin`, abaixo). Uma forma acrescentada aqui é uma forma que o dreno passa a pegar.
 */
export const FORMAS_NO_LINKEDIN: readonly FormaNoLinkedin[] = ["texto", "imagem"];

/** A forma que veio do formulário, de uma lista fechada. */
export function formaNoLinkedinDoCampo(bruto: unknown): FormaNoLinkedin | null {
  return (FORMAS_NO_LINKEDIN as readonly unknown[]).includes(bruto) ? (bruto as FormaNoLinkedin) : null;
}

const MARCADOR_DE_PARAMETRO = /^\$[1-9]\d?$/;

/**
 * O PREDICADO DA FORMA CONHECIDA (a preparação da parte 3 do LinkedIn; docs/plans/2026-11-11-linkedin-forma-conhecida.md).
 *
 * O banco é um só para a produção e os previews, e a parte 3 grava posts do LinkedIn de forma nova (o carrossel em
 * PDF, o vídeo). Este código não os sabe publicar: o ramo do dreno os mandaria a `failed` por payload torto. Com este
 * predicado, a linha de forma que este código não conhece fica `pending`, intocada, e não arma tique, até o código
 * que a conhece chegar, como o tipo desconhecido (`TIPOS_QUE_O_DRENO_CONHECE`, lib/fila-tipos.ts).
 *
 * SÓ A FORMA PRESENTE E DESCONHECIDA FICA DE FORA (nota da auditoria). A linha sem forma, ou com uma forma que não é
 * texto, continua sendo pega e vai a `failed` como antes: ela não é de um código mais novo, é torta, e não pode
 * ficar parada calada para sempre.
 *
 * UM TEXTO SÓ, usado nos quatro pontos do dreno (lib/queue-drain.ts: a seleção, o tique do rodapé, os tiques do dia e
 * o "agora") e no remarcar (app/publicar/post/actions.ts). O marcador é o do parâmetro que leva `FORMAS_NO_LINKEDIN`;
 * nenhum texto de fora entra no SQL.
 */
export function soAFormaConhecidaDoLinkedin(marcador: string): string {
  if (!MARCADOR_DE_PARAMETRO.test(marcador)) throw new Error(`marcador de parâmetro inválido: ${JSON.stringify(marcador)}`);
  return `(kind <> 'publicacao_linkedin' or jsonb_typeof(payload->'forma') is distinct from 'string' or payload->>'forma' = any(${marcador}::text[]))`;
}

export function rotuloDaFormaNoLinkedin(forma: FormaNoLinkedin): string {
  return forma === "texto" ? "Só texto" : "Imagem";
}

/**
 * O NOME DO POST DO LINKEDIN NAS TELAS DE PUBLICAÇÕES, com a rede na frente ("LinkedIn · Só texto"), como a linha
 * do convite do LinkedIn (lib/convites.ts). O post do Instagram continua só com o nome da forma. O payload que não
 * se lê ainda tem nome, porque a linha dele continua existindo e é dela que sai o cancelar.
 */
export function rotuloDoPostNoLinkedin(p: { forma: FormaNoLinkedin } | null): string {
  return `LinkedIn · ${p ? rotuloDaFormaNoLinkedin(p.forma) : "Forma não reconhecida"}`;
}

// ---------------------------------------------------------------------------------------------------------------
// O TEXTO
// ---------------------------------------------------------------------------------------------------------------

/**
 * O LIMITE DO TEXTO: "Posts can contain up to 3,000 characters." (Central de Ajuda do LinkedIn, a528176). A API
 * não diz o número nem como conta, então o limite é contado no texto QUE VAI AO LINKEDIN, depois das hashtags e
 * dos escapes (achado 212): um texto que cabe aqui cabe lá, e a tela e o servidor contam pela mesma função.
 */
export const LIMITE_DO_TEXTO_DO_LINKEDIN = 3000;

// OS 15 CARACTERES RESERVADOS DO "little text" (a página Little Text Format do LinkedIn): "All reserved
// characters need to be escaped with a backslash, even if those characters are not used in one of the supported
// elements or templates."
const RESERVADOS = /[|{}@[\]()<>#\\*_~]/g;
const escapar = (texto: string) => texto.replace(RESERVADOS, (c) => `\\${c}`);

// A HASHTAG CLICÁVEL (decisão do Eduardo, 09/11: "Virar hashtag clicável"): o # no começo de uma palavra,
// seguido de letras, números ou "_", vira o modelo `{hashtag|\#|palavra}` (Little Text Format). Letra é \p{L},
// e não \w, que no JavaScript só pega ASCII ("#educação" viraria "#educa"). O # no meio de uma palavra ("abc#d")
// ou sem palavra depois ("C#") continua texto, escapado.
const HASHTAG = /(?<![\p{L}\p{N}_])#([\p{L}\p{N}_]+)/gu;

/** O texto como vai no `commentary` do post: as hashtags no modelo clicável e o resto escapado. */
export function textoParaOLinkedin(texto: string): string {
  let saida = "";
  let desde = 0;
  for (const achado of texto.matchAll(HASHTAG)) {
    const onde = achado.index ?? 0;
    saida += escapar(texto.slice(desde, onde)) + `{hashtag|\\#|${escapar(achado[1])}}`;
    desde = onde + achado[0].length;
  }
  return saida + escapar(texto.slice(desde));
}

/** O tamanho que conta para o limite: caracteres (e não pedaços de UTF-16) do texto que vai ao LinkedIn. */
export function tamanhoDoTextoNoLinkedin(texto: string): number {
  return Array.from(textoParaOLinkedin(texto)).length;
}

export type ProblemaDoTextoDoLinkedin = "vazio" | "longo";

/** O texto é obrigatório nas duas formas (o `commentary` é "required" no Post Schema), e cabe nos 3.000. */
export function problemaDoTextoDoLinkedin(texto: string, _forma: FormaNoLinkedin): ProblemaDoTextoDoLinkedin | null {
  if (!texto.trim()) return "vazio";
  if (tamanhoDoTextoNoLinkedin(texto.trim()) > LIMITE_DO_TEXTO_DO_LINKEDIN) return "longo";
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// O PEDIDO DE PUBLICAR, NA TELA E NA ACTION
// ---------------------------------------------------------------------------------------------------------------

export type RecusaDoPedidoNoLinkedin = "forma_desconhecida" | "quantidade" | "texto_vazio" | "texto_longo" | "envio_sem_id";

const ID_DO_ENVIO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O QUE IMPEDE O PEDIDO DE VIRAR LINHA NA FILA, numa função só: a tela confere antes de subir o arquivo, a action
 * confere de novo no servidor, e o enfileirar (lib/linkedin-fila.ts) é a terceira barreira. O texto é contado pela
 * mesma `tamanhoDoTextoNoLinkedin` do contador da tela (achado 212). O id do envio é o que a tela gera uma vez por
 * formulário, e é a chave do só texto contra o clique repetido (`chaveDaPublicacaoNoLinkedin`, lib/dedupe.ts).
 */
export function recusaDoPedidoNoLinkedin(p: {
  forma: FormaNoLinkedin | null;
  caminhos: string[];
  texto: string;
  idDoEnvio: string;
}): RecusaDoPedidoNoLinkedin | null {
  if (!p.forma) return "forma_desconhecida";
  if (p.caminhos.length !== (p.forma === "imagem" ? 1 : 0)) return "quantidade";
  const problema = problemaDoTextoDoLinkedin(p.texto, p.forma);
  if (problema === "vazio") return "texto_vazio";
  if (problema === "longo") return "texto_longo";
  if (!ID_DO_ENVIO.test(p.idDoEnvio)) return "envio_sem_id";
  return null;
}

export function textoDaRecusaNoLinkedin(r: RecusaDoPedidoNoLinkedin): string {
  switch (r) {
    case "forma_desconhecida":
      return "Escolha a forma do post no LinkedIn: só texto ou imagem.";
    case "quantidade":
      return "O post do LinkedIn com imagem leva uma imagem, e o só texto não leva arquivo.";
    case "texto_vazio":
      return "Escreva o texto do post.";
    case "texto_longo":
      return "O texto passa de 3.000 caracteres no LinkedIn, onde as hashtags e alguns sinais contam mais. Encurte o texto.";
    case "envio_sem_id":
      return "O formulário chegou incompleto. Recarregue a página e tente de novo.";
  }
}

/**
 * O ID DO ENVIO, gerado pela tela uma vez por formulário: um UUID v4, pelo `crypto.getRandomValues` (que o
 * navegador e o Node têm; o `randomUUID` falta em navegadores antigos e no jsdom de alguns testes).
 */
export function novoIdDoEnvio(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** A frase curta do contador da tela (achado 212): por que o número pode passar do que se digitou. */
export const NOTA_DO_CONTADOR_DO_LINKEDIN = "As hashtags e alguns sinais (como @, _ e *) contam mais de um caractere no LinkedIn.";

export type DisponibilidadeDoLinkedin = { disponivel: true; nome: string } | { disponivel: false; motivo: string };

/**
 * O LINKEDIN DA CONTA NA TELA DE COMPOR: ligado com a conexão dentro da validade; desligado, com o motivo, sem
 * conexão ou com ela vencida (spec, §7). A action confere de novo, pela mesma função.
 */
export function disponibilidadeDoLinkedin(
  resumo: { nome: string; expira_em: Date | string } | null,
  agoraMs: number
): DisponibilidadeDoLinkedin {
  if (!resumo) {
    return {
      disponivel: false,
      motivo: "Esta conta não tem LinkedIn conectado. Quem administra o painel manda o convite pela Configuração.",
    };
  }
  if (vencimentoDoLinkedin(resumo.expira_em, agoraMs).estado === "vencido") {
    return {
      disponivel: false,
      motivo: `O LinkedIn de ${resumo.nome} venceu. Quem administra o painel manda o convite de novo pela Configuração.`,
    };
  }
  return { disponivel: true, nome: resumo.nome };
}

/**
 * O AVISO DEPOIS DE PUBLICAR NO LINKEDIN. O "agora" publica na mesma ida (`drenarUmaPublicacaoDoLinkedin`), então
 * o aviso diz o desfecho: publicado; na fila ("aguardando", ou outro dreno já a pegou); ou não saiu, com o motivo.
 * O agendado ecoa a hora dos campos escolhidos, como `avisoDaPublicacaoEnfileirada` (lib/avisos.ts): o servidor
 * roda em UTC.
 */
export function avisoDoPostNoLinkedin(d: {
  desfecho: "publicado" | "aguardando" | "falhou" | null;
  motivo?: string | null;
  agendadoPara: { dia: number; mes: number; hora: number; minuto: number } | null;
}): { tom: "ok" | "erro"; texto: string } {
  if (d.agendadoPara) {
    const p = (n: number) => String(n).padStart(2, "0");
    const { dia, mes, hora, minuto } = d.agendadoPara;
    return { tom: "ok", texto: `Post do LinkedIn agendado para ${p(dia)}/${p(mes)} às ${p(hora)}:${p(minuto)}. Acompanhe em Publicações.` };
  }
  if (d.desfecho === "publicado") return { tom: "ok", texto: "Post publicado no LinkedIn." };
  if (d.desfecho === "falhou") {
    return { tom: "erro", texto: `O post não saiu no LinkedIn: ${d.motivo?.trim() || "o motivo não foi registrado"}.` };
  }
  return { tom: "ok", texto: "O post do LinkedIn está na fila e vai sair em instantes. Acompanhe em Publicações." };
}

// ---------------------------------------------------------------------------------------------------------------
// O PAYLOAD DA LINHA `publicacao_linkedin` NA FILA
// ---------------------------------------------------------------------------------------------------------------

/**
 * As chaves do `jsonb`. Os passos são marcados ANTES do seguinte, para a passada repetida não refazer o que já
 * foi feito (spec, §6): `imagem_urn` depois do envio da imagem; `post_tentado_em` ANTES do POST do post (achado
 * 210: o POST não tem chave contra repetição, e uma resposta perdida não pode virar um segundo post); e
 * `post_urn` com o id que o LinkedIn devolveu.
 */
export type PayloadDoLinkedin = {
  forma: FormaNoLinkedin;
  caminhos: string[];
  texto: string;
  imagem_urn?: string;
  post_tentado_em?: string;
  post_urn?: string;
};

export function payloadDoLinkedin(pedido: { forma: FormaNoLinkedin; caminhos: string[]; texto: string }): PayloadDoLinkedin {
  return { forma: pedido.forma, caminhos: [...pedido.caminhos], texto: pedido.texto.trim() };
}

export type LeituraDoPayloadDoLinkedin = {
  forma: FormaNoLinkedin;
  caminhos: string[];
  texto: string;
  imagemUrn: string | null;
  postTentadoEm: string | null;
  postUrn: string | null;
};

/** Lê o payload, ou null: a forma tem de ser da lista, o texto tem de ser texto, e a quantidade de arquivos a da forma. */
export function lerPayloadDoLinkedin(bruto: unknown): LeituraDoPayloadDoLinkedin | null {
  if (!bruto || typeof bruto !== "object") return null;
  const p = bruto as Record<string, unknown>;
  const forma = formaNoLinkedinDoCampo(p.forma);
  if (!forma || typeof p.texto !== "string") return null;
  const caminhos = Array.isArray(p.caminhos) && p.caminhos.every((c) => typeof c === "string") ? (p.caminhos as string[]) : null;
  if (!caminhos || caminhos.length !== (forma === "imagem" ? 1 : 0)) return null;
  const texto = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    forma,
    caminhos,
    texto: p.texto,
    imagemUrn: texto(p.imagem_urn),
    postTentadoEm: texto(p.post_tentado_em),
    postUrn: texto(p.post_urn),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// O CORPO DO POST E O LINK PARA VER
// ---------------------------------------------------------------------------------------------------------------

/**
 * O corpo do `POST /rest/posts` (Posts API): o autor é a pessoa, o texto já transformado, PÚBLICO (fixo nesta
 * entrega; não há escolha de visibilidade na tela), no feed, publicado, e a imagem quando há.
 */
export function corpoDoPost(p: { pessoaId: string; texto: string; imagemUrn?: string }): Record<string, unknown> {
  return {
    author: `urn:li:person:${p.pessoaId}`,
    commentary: textoParaOLinkedin(p.texto),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
    ...(p.imagemUrn ? { content: { media: { id: p.imagemUrn } } } : {}),
  };
}

const URN_DE_POST = /^urn:li:(?:share|ugcPost):\d+$/;

/** "Ver no LinkedIn": o endereço do feed, só para um URN de post (Posts API: `/feed/update/<urn>/`). */
export function linkParaVerNoLinkedin(postUrn: string | null | undefined): string | null {
  return postUrn && URN_DE_POST.test(postUrn) ? `https://www.linkedin.com/feed/update/${postUrn}/` : null;
}

// ---------------------------------------------------------------------------------------------------------------
// OS ERROS
// ---------------------------------------------------------------------------------------------------------------

export type DesfechoDoErroDoLinkedin = "autorizacao" | "permanente" | "passageiro";

/**
 * O 401 é a autorização que não vale mais (venceu ou foi retirada); o 429, o 409 ("Retry the request"), os 5xx
 * e a rede (status 0) passam; o 403 e os outros 4xx não passam sozinhos (Posts API, "API Error Details").
 */
export function desfechoDoErroDoLinkedin(status: number): DesfechoDoErroDoLinkedin {
  if (status === 401) return "autorizacao";
  if (status === 0 || status === 409 || status === 429 || status >= 500) return "passageiro";
  return "permanente";
}

export function motivoDaAutorizacaoRecusada(nome: string): string {
  return `o LinkedIn de ${nome} não aceita mais a autorização (venceu ou foi retirada); mande o convite de novo`;
}

/**
 * DEPOIS DO POST, O POST PODE TER SAÍDO? (achado 210). O `POST /rest/posts` não tem chave contra repetição, então
 * só uma resposta 4xx prova que o LinkedIn não criou nada. A rede (0), o 5xx e o 2xx sem o `x-restli-id` deixam a
 * dúvida, e a linha não pode ser tentada de novo: o dono confere no LinkedIn.
 */
export function oPostPodeTerSaido(status: number): boolean {
  return !(status >= 400 && status < 500);
}
