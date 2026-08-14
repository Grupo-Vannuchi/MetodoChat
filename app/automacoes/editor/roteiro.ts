// O ROTEIRO DA CONVERSA: a lista de blocos virando a sequência de coisas a
// desenhar na prévia.
//
// Arquivo PURO de propósito — sem React, sem DOM, sem cor, sem classe de CSS.
// Recebe `Passo[]` e devolve uma lista de cenas. É pelo mesmo motivo de
// `./geometria`: nesta fase, o que virou função pura testada não deu defeito, e
// o que ficou solto dentro de um `.tsx` deu em toda tarefa.
//
// A DIVISÃO DE TRABALHO com `previa.tsx` é a regra deste arquivo: aqui mora
// QUEM FALA, EM QUE ORDEM e ONDE O FLUXO PARA; lá mora como isso aparece. Uma
// decisão de conteúdo escrita no JSX é uma decisão sem teste.
//
// AS REGRAS DE CONTEÚDO VÊM DE `lib/steps.ts`, e não são reescritas aqui:
// `conferir` diz se o bloco é enviado, `envioDaDm` diz em que forma uma `dm`
// sai, e `esperaResposta` diz se o bloco para o fluxo. Copiá-las para cá criaria
// uma segunda fonte de verdade justamente para as coisas que a prévia existe
// para contar — e a prévia mentindo sobre o fluxo é pior do que prévia nenhuma.
//
// E `esperaResposta` MANDA NOS TRÊS QUE PARAM, não só na `dm`. A versão
// anterior deste arquivo consultava `esperaResposta` no ramo `dm` e escrevia a
// parada À MÃO nos ramos `pedir_follow` e `pedir_email` — o cabeçalho prometia
// fonte única e ela valia em um terço dos casos. A revisão provou a divergência
// mutando `esperaResposta` para o `pedir_email` deixar de esperar:
// `tests/editor-roteiro.test.ts` continuava verde e a prévia continuava
// desenhando a parada. Hoje os três passam pela função, e a mesma mutação
// acende teste.
//
// SEM O TIPO `Passo` NA ASSINATURA de propósito — ver `roteiro`, lá embaixo: a
// entrada é `unknown`, e quem devolve o passo já tipado é `conferir`.
import { conferir, envioDaDm, esperaResposta } from "@/lib/steps";

// O que a prévia desenha. Cada item é uma coisa na tela, na ordem em que ela
// aparece na conversa.
//
// `balao` é o que A CONTA manda; `resposta` é o que A PESSOA manda de volta —
// o toque no botão (que no Instagram entra na conversa como mensagem dela) ou
// o endereço de e-mail digitado.
export type Bolha =
  // Uma mensagem da conta. `botao` é o rótulo, quando há; `link` diz se ele
  // abre um endereço (vai dentro do balão) ou se é resposta rápida (vira uma
  // pílula solta, que a pessoa toca).
  | { tipo: "balao"; texto: string; botao: string | null; link: boolean }
  // A MARCA DA PARADA. É a informação mais valiosa da prévia: daqui não sai
  // nada até a pessoa fazer alguma coisa.
  | { tipo: "parada"; motivo: "toque" | "follow" | "email" }
  | { tipo: "resposta"; texto: string }
  // `esperar` não é mensagem: é uma marca de tempo entre os balões.
  | { tipo: "tempo"; texto: string }
  // Estas duas NÃO são DM, e é por isso que têm tipo próprio em vez de virarem
  // balão: a resposta pública sai no comentário do post, e o coraçãozinho é
  // uma reação na mensagem que a pessoa mandou.
  //
  // AS DUAS CARREGAM O QUE O GATILHO DECIDE, e carregam aqui em vez de na tela.
  // A `resposta_publica` já era consciente do gatilho — mas pela prop `noPost`
  // de `previa.tsx`, ou seja, numa decisão de conteúdo escrita no JSX —, e o
  // `reagir_story` não era de jeito nenhum: com o gatilho de comentário o nó
  // ficava com borda vermelha (`conferirLista` acusa) e a prévia, logo abaixo do
  // mesmo erro, prometia "reage à mensagem que a pessoa mandou". Agora as duas
  // decidem no mesmo lugar, com teste.
  //
  // `situacao` da pública, e os três casos são os que `conferirLista` conhece:
  //   `publicada`      — sai mesmo. Só no gatilho de comentário, e só a
  //                      PRIMEIRA da lista.
  //   `fora_do_gatilho`— `enfileirarPasso` (lib/engine.ts) faz
  //                      `if (!contexto.commentId) return`, e só o comentário
  //                      traz o post a responder.
  //   `repetida`       — a segunda em diante. `commentReplyKey(comment_id)`
  //                      (lib/dedupe.ts) é a mesma string das duas, e o
  //                      `on conflict do nothing` engole a segunda.
  //
  // `vazias` é quantas das variações não têm nada escrito. O motor SORTEIA uma
  // delas a cada disparo e desiste quando a sorteada está em branco, então
  // "uma das 2 variações" sem essa contagem promete duas e entrega uma às
  // vezes — a perda intermitente que `conferirLista` decidiu não acusar, e que
  // a prévia PODE dizer porque ela é o lugar onde se vê o resultado.
  | {
      tipo: "publica";
      texto: string;
      variacoes: number;
      vazias: number;
      situacao: "publicada" | "fora_do_gatilho" | "repetida";
    }
  // `alvo` é a QUEM o coraçãozinho reage naquele gatilho, e o `nenhum` é o
  // ponto: no gatilho de comentário não chega mensagem nenhuma, o bloco não
  // roda, e a cena não pode prometer entrega.
  | { tipo: "reacao"; emoji: string; alvo: "story" | "mensagem" | "nenhum" }
  // Bloco que `conferir` recusa. Ele NÃO é enviado — `interpretar` o ignora —,
  // então ele não pode aparecer como se fosse uma mensagem.
  | { tipo: "incompleto"; mensagem: string };

// Uma cena é TUDO o que um bloco produz, junto com o índice dele na lista.
//
// O agrupamento por bloco não é organização: é o que permite destacar na
// prévia o bloco que está aberto no painel. Uma lista achatada de bolhas
// perderia a fronteira — a `dm` de resposta rápida produz três itens (o balão,
// a marca da parada e o toque da pessoa), e destacar só o primeiro deixaria a
// parada de fora justamente no bloco em que ela é a informação principal.
export type Cena = { indice: number; itens: Bolha[] };

// O endereço de exemplo que a pessoa "responde" ao pedido de e-mail. Mora aqui,
// e não no JSX, para a prévia inteira ser decidida num arquivo com teste. É o
// mesmo exemplo que a prévia antiga usa.
const EMAIL_DE_EXEMPLO = "ana@email.com";

// O rótulo do botão de link quando ele está sem nome. `conferir` (lib/steps.ts)
// não exige `botao_label` em `dm` nenhuma, então este caso chega aqui.
//
// ELE FICA PORQUE É VERDADE, e a frase abaixo existe para ninguém "uniformizar"
// os dois padrões de novo — houve um `FOLLOW_PADRAO` irmão deste, e ele saiu.
//
// `linkMessage` (lib/ig.ts) monta o botão com
// `title: buttonLabel || "Abrir link"`: sem rótulo, o botão SAI, com esse texto
// exato. A prévia desenhando "Abrir link" está mostrando o que a pessoa vai
// receber.
//
// O PORTÃO NÃO TEM NADA DISSO, e é por isso que os dois só PARECEM simétricos.
// `resolverFollow` (lib/engine.ts) passa `quick_reply_label: passo.botao_label`
// sem default nenhum, e `lib/queue-drain.ts` exige
// `quick_reply_label && quick_reply_payload` para montar a resposta rápida —
// com o rótulo vazio a mensagem cai no `else` e sai como TEXTO PURO, sem botão.
// Um `FOLLOW_PADRAO` aqui desenharia uma pílula que o Instagram nunca entrega,
// escondendo justamente a armadilha. Quem recusa esse bloco é `conferirLista`
// (lib/steps.ts), com ERRO, e a prévia mostra a consequência: balão sem botão e
// a parada logo abaixo, sem ninguém para tocá-la.
const LINK_PADRAO = "Abrir link";

// A marca de tempo de um `esperar`, em português de gente.
//
// Arredonda porque `conferir` (lib/steps.ts) aceita qualquer número finito não
// negativo — inclusive `0.5`, que o campo de minutos do painel produz se alguém
// digitar isso. "0,5 minutos depois" não é frase.
//
// ZERO NÃO É ERRO e por isso não é acusado aqui: `conferirLista` (lib/steps.ts)
// decidiu de propósito não reclamar de `minutos: 0` — a espera não atrasa nada,
// mas também não quebra nada. A prévia diz o que acontece: nada de espera.
export function textoDoTempo(minutos: number): string {
  const m = Math.round(minutos);
  if (m <= 0) return "logo em seguida";
  if (m < 60) return `${m} ${m === 1 ? "minuto" : "minutos"} depois`;
  const horas = Math.floor(m / 60);
  const resto = m % 60;
  const parte = `${horas} ${horas === 1 ? "hora" : "horas"}`;
  return resto ? `${parte} e ${resto} min depois` : `${parte} depois`;
}

// A conversa que esta lista produz, na ordem em que ela produz.
//
// TODOS OS BLOCOS ENTRAM, inclusive os que vêm depois de uma parada dura. A
// prévia existe para quem está MONTANDO, e quem monta precisa ver onde o bloco
// que está editando cai — esconder a cauda depois da primeira parada faria a
// prévia sumir com metade da lista justamente na lista mais comum, que começa
// com a boas-vindas de resposta rápida.
//
// O que a parada faz é aparecer: a marca entra na cena, e logo depois vem o
// toque da pessoa. Assim a cauda continua visível SEM mentir sobre quando ela
// sai.
//
// `unknown` na entrada, e não `Passo[]`, pelo mesmo motivo de `interpretar`
// (lib/steps.ts): a lista também chega do banco, onde ela é `unknown[]` e nada
// confere o tipo em runtime. Uma lista que não é lista devolve roteiro vazio, e
// a tela mostra o vazio em vez de quebrar.
//
// O GATILHO É OBRIGATÓRIO, e não tem valor padrão de propósito. Dois dos seis
// tipos só rodam em alguns gatilhos, e um padrão faria a prévia prometer
// entrega no gatilho errado calada — que é exatamente o defeito que esta
// assinatura veio corrigir. Um chamador que não sabe o gatilho não sabe o
// suficiente para desenhar a conversa.
export function roteiro(passos: unknown, gatilho: string): Cena[] {
  if (!Array.isArray(passos)) return [];

  const cenas: Cena[] = [];
  // Só a PRIMEIRA resposta pública é publicada, e é preciso contar para saber
  // qual é: `commentReplyKey` (lib/dedupe.ts) não conhece o bloco, então a
  // segunda sai com a mesma chave e o `on conflict do nothing` a engole. É a
  // mesma razão pela qual `conferirLista` (lib/steps.ts) trata a segunda como
  // ERRO — e a prévia apontava a segunda para o texto da PRIMEIRA no cartão do
  // post, dizendo "sai no comentário do post, acima" sobre um texto que não é
  // o dela.
  let publicasVistas = 0;

  for (let i = 0; i < passos.length; i++) {
    const { passo, paraODono } = conferir(passos[i]);

    // A MENSAGEM É A DO DONO, e não o `motivo` técnico, pela mesma razão de
    // `conferirLista` (lib/steps.ts): quem lê a prévia é quem está montando a
    // automação, e "pedir_email sem texto" é nome de tipo interno.
    if (!passo) {
      cenas.push({ indice: i, itens: [{ tipo: "incompleto", mensagem: paraODono! }] });
      continue;
    }

    const itens: Bolha[] = [];

    switch (passo.tipo) {
      case "dm": {
        // A FORMA DA MENSAGEM SAI DE `envioDaDm`, e não de condições escritas
        // aqui. É a MESMA chamada que `enfileirarPasso` (lib/engine.ts) faz para
        // escolher o `kind` e o payload da fila, e é dela que `esperaResposta`
        // deriva a parada — então o que a prévia desenha é, por construção, o
        // que a pessoa recebe.
        //
        // Este ramo tinha DUAS cópias da regra: `esperaResposta` seguida de
        // `passo.botao_label!`, e um `if (passo.url)` logo abaixo. A asserção
        // não-nula era a mais cara das duas — ela afirmava ao `tsc` uma
        // invariante de OUTRO arquivo, e quando `esperaResposta` passou a dizer
        // sim a um `dm` com `botoes` (sem rótulo nenhum) a afirmação virou
        // falsa sem nada acusar. Agora o rótulo vem do próprio `envio`, com
        // tipo, e não há o que afirmar.
        //
        // O "LINK SEM ENDEREÇO" (`url: ""` com rótulo) continua caindo na
        // resposta rápida, e continua sendo o ponto: pelo VALOR ele é
        // indistinguível de uma, o motor o envia como uma, e o fluxo para nele
        // para sempre esperando um toque que não leva a lugar nenhum. É o
        // defeito que esta base já teve — um lembrete salvo sem link virou
        // parada dura sem ninguém pedir —, e aqui ele fica visível na tela. Quem
        // diz que aquilo é ERRO é `conferirLista`, no painel, logo acima da
        // prévia; o que a prévia mostra é a consequência.
        const envio = envioDaDm(passo);
        if (envio.forma === "resposta_rapida") {
          itens.push({ tipo: "balao", texto: passo.texto, botao: envio.rotulo, link: false });
          itens.push({ tipo: "parada", motivo: "toque" });
          itens.push({ tipo: "resposta", texto: envio.rotulo });
          break;
        }
        // Botão de link: a pessoa abre o endereço e a vida segue — não há o que
        // esperar, e por isso não há parada.
        //
        // O padrão de rótulo é da PRÉVIA, e não de `envioDaDm`: quem escreve
        // "Abrir link" numa mensagem sem rótulo é `linkMessage` (lib/ig.ts), na
        // hora de montar o template, e é isso que esta linha está desenhando.
        if (envio.forma === "link") {
          itens.push({
            tipo: "balao",
            texto: passo.texto,
            botao: envio.rotulo || LINK_PADRAO,
            link: true,
          });
          break;
        }
        itens.push({ tipo: "balao", texto: passo.texto, botao: null, link: false });
        break;
      }

      case "esperar":
        itens.push({ tipo: "tempo", texto: textoDoTempo(passo.minutos) });
        break;

      // OS DOIS PORTÕES PARAM O FLUXO — `esperaResposta` diz sim aos dois —,
      // e a prévia marca os dois. O que os separa é o MOTIVO, e ele não é
      // decoração: só o follow é reavaliado quando alguém chega do outro lado
      // por outro caminho (a regra do portão, `atravessandoOPortao` em
      // lib/steps.ts, cobre `pedir_follow` e mais nada). É a mesma distinção
      // que o painel escreve e que a cor do nó carrega.
      //
      // A PARADA SAI DE `esperaResposta` NOS DOIS, como no ramo `dm` acima. Ela
      // diz sim a todo `pedir_follow` e a todo `pedir_email` hoje, então a cena
      // não muda — o que muda é que a prévia deixa de ter uma cópia da regra: se
      // um dos dois deixar de esperar, a parada some daqui sozinha, em vez de
      // continuar desenhada por um `push` escrito à mão.
      case "pedir_follow": {
        // SEM PÍLULA QUANDO NÃO HÁ RÓTULO, e este é o caso que a prévia existe
        // para denunciar. Com `botao_label: ""` o motor manda TEXTO PURO —
        // `lib/queue-drain.ts` exige `quick_reply_label && quick_reply_payload`
        // — e o fluxo para no portão sem nada para tocar. Desenhar um "Já sigo!
        // ✅" inventado (o antigo `FOLLOW_PADRAO`) escondia exatamente isso. O
        // motivo por extenso, e por que o `LINK_PADRAO` fica, está lá em cima.
        //
        // E não há `resposta` nenhuma nesse caso: a bolha da direita é o TOQUE
        // da pessoa, e não há botão em que tocar. `conferirLista` (lib/steps.ts)
        // acusa ERRO nesse bloco, logo acima da prévia, no painel.
        const rotulo = passo.botao_label || null;
        itens.push({ tipo: "balao", texto: passo.texto, botao: rotulo, link: false });
        if (esperaResposta(passo)) {
          itens.push({ tipo: "parada", motivo: "follow" });
          if (rotulo) itens.push({ tipo: "resposta", texto: rotulo });
        }
        break;
      }

      case "pedir_email":
        itens.push({ tipo: "balao", texto: passo.texto, botao: null, link: false });
        if (esperaResposta(passo)) {
          itens.push({ tipo: "parada", motivo: "email" });
          itens.push({ tipo: "resposta", texto: EMAIL_DE_EXEMPLO });
        }
        break;

      // O MOTOR SORTEIA UMA DAS VARIAÇÕES a cada disparo (`enfileirarPasso`,
      // lib/engine.ts), então a prévia não tem como mostrar "a" resposta. Mostra
      // a primeira aproveitável e diz quantas existem — a contagem é o que
      // impede a prévia de prometer um texto fixo.
      //
      // A PRIMEIRA COM TEXTO, e não `textos[0]`: o painel guarda as linhas em
      // branco de propósito (sem `.filter()`, senão não dá para digitar a
      // segunda variação), então `textos[0]` é "" com frequência — e a prévia
      // mostraria vazio uma resposta pública que funciona.
      //
      // AS VAZIAS SÃO CONTADAS À PARTE porque o sorteio não as pula: o motor
      // sorteia e faz `if (!texto?.trim()) return`. Logo depois do Enter — o
      // gesto normal para criar a segunda variação — existe uma linha em branco,
      // e "uma das 2 variações, sorteada" prometia duas com uma que não publica
      // nada.
      case "resposta_publica": {
        publicasVistas++;
        itens.push({
          tipo: "publica",
          texto: passo.textos.find((t) => typeof t === "string" && t.trim()) ?? "",
          variacoes: passo.textos.length,
          vazias: passo.textos.filter((t) => typeof t !== "string" || !t.trim()).length,
          situacao:
            gatilho !== "comment"
              ? "fora_do_gatilho"
              : publicasVistas > 1
                ? "repetida"
                : "publicada",
        });
        break;
      }

      // O CORAÇÃOZINHO REAGE À MENSAGEM QUE A PESSOA MANDOU, e é o gatilho que
      // decide se existe alguma.
      //
      //   `story` — a mensagem é a resposta dela ao story. `handleMessage`
      //     (lib/engine.ts) chama `executarFluxo(..., { messageId: msg.mid })`.
      //   `dm` — o MESMO caminho, com a DM comum. O bloco roda, e é por isso que
      //     `conferirLista` (lib/steps.ts) dá AVISO aqui e não erro.
      //   qualquer outro (comentário) — não chega mensagem nenhuma, e
      //     `enfileirarPasso` desiste. O bloco NUNCA roda, `conferirLista` dá
      //     ERRO, e a cena não pode prometer entrega — era o que ela fazia.
      case "reagir_story":
        itens.push({
          tipo: "reacao",
          emoji: passo.emoji,
          alvo: gatilho === "story" ? "story" : gatilho === "dm" ? "mensagem" : "nenhum",
        });
        break;
    }

    cenas.push({ indice: i, itens });
  }

  return cenas;
}
