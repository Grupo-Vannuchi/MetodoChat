import { novoIdDeBloco, type Passo } from "@/lib/steps";

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
  // "PORTÃO" É PALAVRA DE UM SÓ, e ela foi tirada do e-mail de propósito.
  //
  // Os dois param o fluxo esperando resposta, mas só o follow é REAVALIADO
  // quando alguém chega do outro lado por outro caminho: a regra do portão
  // (`atravessandoOPortao`, lib/steps.ts) cobre `pedir_follow` e mais nada.
  // Chamar os dois de portão fazia a paleta prometer, para o e-mail, uma
  // proteção que não existe — e o preço disso é o link saindo com o endereço
  // nunca capturado. A cor do bloco carrega a mesma distinção (ver `no.tsx`).
  { chave: "pedir_follow", rotulo: "Pedir follow", descricao: "portão: ninguém passa sem seguir", gatilhos: null },
  { chave: "pedir_email", rotulo: "Pedir e-mail", descricao: "espera o endereço (não é portão)", gatilhos: null },
  { chave: "resposta_publica", rotulo: "Resposta pública", descricao: "só no gatilho de comentário", gatilhos: ["comment"] },
  { chave: "reagir_story", rotulo: "Coraçãozinho", descricao: "só no gatilho de story", gatilhos: ["story"] },
];

// `novoIdDeBloco` vinha copiada de `app/automacoes/actions.ts` — as duas cópias
// tinham o mesmo defeito de comprimento ao mesmo tempo. Agora ela vem de
// `lib/steps.ts`, ao lado de `FORMA_DO_ID`, que é quem a valida.

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

// Um bloco novo. Os textos-padrão existem para que SETE dos oito itens da paleta
// nasçam válidos: sem eles, um `dm` recém-arrastado teria `texto: ""` e
// `conferirLista` (lib/steps.ts) travaria o salvar antes de a pessoa ter tido a
// chance de digitar qualquer coisa.
//
// O OITAVO — "Mensagem com link" — NASCE COM ERRO, e isso é de propósito.
// `url: ""` casa com a regra do link sem endereço e acende ERRO no instante da
// criação, apontando o campo que falta: o endereço. Não há padrão honesto a
// inventar aqui — não existe url plausível para semear —, e link sem endereço é
// erro por definição, não um estado que dê para adiar. Quem arrasta esse bloco
// arrastou justamente para digitar o endereço, então o erro é a instrução do que
// fazer em seguida, e ele apaga sozinho na primeira letra digitada.
//
// O que NÃO se pode fazer para "consertar" isso é omitir a chave `url`: sem ela
// o bloco vira indistinguível de uma resposta rápida, o erro deixa de acender, e
// o fluxo trava em silêncio na hora do envio (a convenção logo acima).
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
    // Só o follow leva "PORTÃO" no título, pelo mesmo motivo da paleta logo
    // acima: é o único que a regra do portão reavalia. O e-mail espera resposta
    // como qualquer parada, e o rótulo diz isso — não que ele barre.
    case "pedir_follow":
      return { titulo: "PORTÃO · PEDIR FOLLOW", corpo: p.texto };
    case "pedir_email":
      return { titulo: "PEDIR E-MAIL", corpo: p.texto };
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
