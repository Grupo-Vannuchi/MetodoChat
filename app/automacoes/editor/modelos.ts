import type { Passo } from "@/lib/steps";

// A paleta tem OITO itens sobre SEIS tipos, e a diferença não é maquiagem.
//
// "Mensagem", "Mensagem com botão" e "Mensagem com link" salvam todas
// `tipo: "dm"`. O que separa uma DM que PARA o fluxo de uma que segue é ter
// rótulo de botão SEM url — uma diferença invisível no dado, que já causou
// defeito: um lembrete salvo sem link virou parada dura e o fluxo travou ali,
// sem ninguém ter pedido isso. Nomear os três casos faz a distinção aparecer
// na hora de criar, não depois.
//
// `gatilhos: null` = serve em qualquer um.
export type ItemDaPaleta = {
  chave: string;
  rotulo: string;
  descricao: string;
  gatilhos: string[] | null;
};

export const PALETA: ItemDaPaleta[] = [
  { chave: "dm", rotulo: "Mensagem", descricao: "texto simples", gatilhos: null },
  { chave: "dm_botao", rotulo: "Mensagem com botão", descricao: "o fluxo espera o toque", gatilhos: null },
  { chave: "dm_link", rotulo: "Mensagem com link", descricao: "botão que abre um endereço", gatilhos: null },
  { chave: "esperar", rotulo: "Esperar", descricao: "atrasa o que vier depois", gatilhos: null },
  { chave: "pedir_follow", rotulo: "Pedir follow", descricao: "portão: só passa quem segue", gatilhos: null },
  { chave: "pedir_email", rotulo: "Pedir e-mail", descricao: "portão: guarda o endereço", gatilhos: null },
  { chave: "resposta_publica", rotulo: "Resposta pública", descricao: "só no gatilho de comentário", gatilhos: ["comment"] },
  { chave: "reagir_story", rotulo: "Coraçãozinho", descricao: "só no gatilho de story", gatilhos: ["story"] },
];

// Mesma geração de `app/automacoes/actions.ts`. O prefixo `b_` é exigido por
// `identidadeDoPasso` (lib/steps.ts), e o motivo está escrito lá.
export function novoIdDeBloco(): string {
  return "b_" + Math.random().toString(36).slice(2, 10);
}

// A CONVENÇÃO DA CHAVE `url`, que este arquivo é a origem de.
//
// "Mensagem com link" semeia SEMPRE a chave `url`, mesmo vazia; "Mensagem" e
// "Mensagem com botão" NUNCA a gravam. É a presença da CHAVE — não o valor —
// que diz "isto é um botão de link", e é dela que depende o erro "mensagem com
// link sem endereço" de `conferirLista` (lib/steps.ts), que tem o mecanismo
// inteiro escrito no comentário de lá.
//
// O caso que a convenção existe para separar é o `dm_link` sem endereço
// (`url: ""`): pelo VALOR ele é indistinguível de uma resposta rápida
// (`Boolean(botao_label) && !url` é verdade nos dois), e pela CHAVE ele é o que
// de fato é. Sem ela, `conferirLista` acenderia ERRO num bloco que a tela
// chamaria de "mensagem com botão" — o dono lê um diagnóstico sobre outra coisa.
//
// Ela vale em TRÊS lugares, e os três precisam usar o mesmo critério:
//   `blocoNovo` (aqui) ....... semeia `url: ""` só em `dm_link`
//   `resumoDoBloco` (aqui) ... classifica pela CHAVE, `p.url !== undefined`
//   painel do bloco (T7) ..... pela chave, e NUNCA apaga a chave: esvaziar o
//                              campo do endereço grava `""`, não remove `url`
//
// Removendo a chave, o bloco vira indistinguível de uma resposta rápida e o
// erro deixa de acender — em silêncio, que é o modo de falhar que esta
// convenção inteira existe para evitar.

// Um bloco novo, já válido. Os textos-padrão existem para o bloco recém-criado
// não nascer inválido e travar o salvar antes de a pessoa digitar qualquer
// coisa.
export function blocoNovo(chave: string): Passo {
  const id = novoIdDeBloco();
  switch (chave) {
    case "dm":
      return { id, tipo: "dm", texto: "Escreva a mensagem aqui" };
    case "dm_botao":
      return { id, tipo: "dm", texto: "Escreva a mensagem aqui", botao_label: "Quero!" };
    case "dm_link":
      return { id, tipo: "dm", texto: "Aqui está o seu link!", botao_label: "Abrir link", url: "" };
    case "esperar":
      return { id, tipo: "esperar", minutos: 60 };
    case "pedir_follow":
      return { id, tipo: "pedir_follow", texto: "Antes de te mandar o link, me segue lá no perfil 🙏", botao_label: "Já sigo! ✅" };
    case "pedir_email":
      return { id, tipo: "pedir_email", texto: "Me manda seu melhor e-mail que eu te envio o link 👇" };
    case "resposta_publica":
      return { id, tipo: "resposta_publica", textos: ["Te mandei no direct! 📩"] };
    case "reagir_story":
      return { id, tipo: "reagir_story", emoji: "❤️" };
    default:
      return { id, tipo: "dm", texto: "Escreva a mensagem aqui" };
  }
}

// O que o nó mostra fechado. O corpo é cortado por CSS, não aqui — cortar no
// dado esconderia da prévia o texto que a pessoa acabou de digitar.
//
// A `dm` é classificada pela CHAVE `url`, e não pelo valor dela. `if (p.url)`
// seria a mesma leitura que `esperaResposta` (lib/steps.ts) faz, e por isso
// intitularia MENSAGEM COM BOTÃO justamente o bloco em que `conferirLista`
// acende ERRO de "mensagem com link sem endereço" — o `dm_link` com `url: ""`.
// Título e diagnóstico falariam de blocos diferentes na mesma tela.
//
// O teste é contra `undefined`, e não `"url" in p`, pelo mesmo motivo que
// `conferirLista` usa: a saída EM MEMÓRIA de `montarPassos`
// (app/automacoes/actions.ts) grava `url: fu.url || undefined` — a chave está
// presente com valor `undefined`, e `"url" in p` diria `true` para toda
// mensagem sem link.
export function resumoDoBloco(p: Passo): { titulo: string; corpo: string } {
  switch (p.tipo) {
    case "dm":
      if (p.url !== undefined) return { titulo: "MENSAGEM COM LINK", corpo: p.texto };
      if (p.botao_label) return { titulo: "MENSAGEM COM BOTÃO", corpo: p.texto };
      return { titulo: "MENSAGEM", corpo: p.texto };
    case "esperar":
      return { titulo: "ESPERAR", corpo: `${p.minutos} minutos` };
    case "pedir_follow":
      return { titulo: "PORTÃO · PEDIR FOLLOW", corpo: p.texto };
    case "pedir_email":
      return { titulo: "PORTÃO · PEDIR E-MAIL", corpo: p.texto };
    case "resposta_publica":
      return { titulo: "RESPOSTA PÚBLICA", corpo: p.textos.join(" · ") };
    case "reagir_story":
      return { titulo: "CORAÇÃOZINHO", corpo: p.emoji };
  }
}

// Onde pôr os blocos que não têm posição gravada — toda automação criada antes
// da Fase 1b, e todo bloco recém-inserido pela seta.
//
// Escada diagonal em vez de coluna reta: com as setas curvas do React Flow,
// blocos alinhados na vertical fazem a seta passar POR DENTRO do bloco de
// baixo. O deslocamento horizontal deixa a curva visível.
//
// Ela acrescenta `pos` e NADA MAIS. Em particular não semeia nem apaga a chave
// `url`: o espalhamento copia o bloco como ele veio do banco, e é isso que
// mantém a decisão sobre o bloco legado (ver `quadro.tsx`) sendo "não mexer".
const LARGURA = 250;
const ALTURA = 96;

export function arranjoAutomatico(passos: Passo[]): Passo[] {
  return passos.map((p, i) =>
    p.pos ? p : { ...p, pos: { x: 60 + i * LARGURA, y: 60 + i * ALTURA } }
  );
}
