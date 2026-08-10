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
// AS DUAS REGRAS DE CONTEÚDO VÊM DE `lib/steps.ts`, e não são reescritas aqui:
// `conferir` diz se o bloco é enviado, `esperaResposta` diz se ele para o
// fluxo. Copiá-las para cá criaria uma segunda fonte de verdade justamente
// para as duas coisas que a prévia existe para contar — e a prévia mentindo
// sobre o fluxo é pior do que prévia nenhuma.
//
// SEM O TIPO `Passo` NA ASSINATURA de propósito — ver `roteiro`, lá embaixo: a
// entrada é `unknown`, e quem devolve o passo já tipado é `conferir`.
import { conferir, esperaResposta } from "@/lib/steps";

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
  | { tipo: "publica"; texto: string; variacoes: number }
  | { tipo: "reacao"; emoji: string }
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

// O rótulo do "Já sigo!" quando o bloco está com o campo vazio.
//
// `conferir` (lib/steps.ts) exige o TEXTO do `pedir_follow`, não o rótulo do
// botão — então `botao_label: ""` é um bloco válido, que o motor envia com um
// botão sem nome. Desenhar uma pílula em branco esconderia isso; o padrão é o
// mesmo texto que a paleta semeia, e é o que a prévia antiga já mostrava.
const FOLLOW_PADRAO = "Já sigo! ✅";

// O rótulo do botão de link quando ele está sem nome, pelo mesmo motivo acima:
// `conferir` não exige `botao_label` em `dm` nenhuma.
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
export function roteiro(passos: unknown): Cena[] {
  if (!Array.isArray(passos)) return [];

  const cenas: Cena[] = [];

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
        // A PARADA DURA SAI DE `esperaResposta`, e não de uma condição escrita
        // aqui. É a mesma leitura que o motor faz — `enfileirarPasso`
        // (lib/engine.ts) monta `respostaRapida = Boolean(p.botao_label) &&
        // !p.url` —, então o que a prévia marca como parada é exatamente o que
        // trava a conversa de verdade.
        //
        // ISSO INCLUI O "LINK SEM ENDEREÇO" (`url: ""` com rótulo), e incluir é
        // o ponto: pelo VALOR ele é indistinguível de uma resposta rápida, o
        // motor o envia como resposta rápida, e o fluxo para nele para sempre
        // esperando um toque que não leva a lugar nenhum. É o defeito que esta
        // base já teve — um lembrete salvo sem link virou parada dura sem
        // ninguém pedir —, e aqui ele fica visível na tela. Quem diz que aquilo
        // é ERRO é `conferirLista`, no painel, logo acima da prévia; o que a
        // prévia mostra é a consequência.
        if (esperaResposta(passo)) {
          const rotulo = passo.botao_label!;
          itens.push({ tipo: "balao", texto: passo.texto, botao: rotulo, link: false });
          itens.push({ tipo: "parada", motivo: "toque" });
          itens.push({ tipo: "resposta", texto: rotulo });
          break;
        }
        // Botão de link: a pessoa abre o endereço e a vida segue — não há o que
        // esperar, e por isso não há parada.
        //
        // Pelo VALOR de `url`, e não pela chave, ao contrário de
        // `resumoDoBloco` (modelos.ts): o título do nó classifica o que o bloco
        // É (a chave `url` diz "isto é um bloco de link"), e a prévia desenha o
        // que ele FAZ. Um `url: ""` não abre endereço nenhum, e já caiu no ramo
        // de cima quando tem rótulo.
        if (passo.url) {
          itens.push({
            tipo: "balao",
            texto: passo.texto,
            botao: passo.botao_label || LINK_PADRAO,
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
      case "pedir_follow": {
        const rotulo = passo.botao_label || FOLLOW_PADRAO;
        itens.push({ tipo: "balao", texto: passo.texto, botao: rotulo, link: false });
        itens.push({ tipo: "parada", motivo: "follow" });
        itens.push({ tipo: "resposta", texto: rotulo });
        break;
      }

      case "pedir_email":
        itens.push({ tipo: "balao", texto: passo.texto, botao: null, link: false });
        itens.push({ tipo: "parada", motivo: "email" });
        itens.push({ tipo: "resposta", texto: EMAIL_DE_EXEMPLO });
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
      case "resposta_publica":
        itens.push({
          tipo: "publica",
          texto: passo.textos.find((t) => typeof t === "string" && t.trim()) ?? "",
          variacoes: passo.textos.length,
        });
        break;

      case "reagir_story":
        itens.push({ tipo: "reacao", emoji: passo.emoji });
        break;
    }

    cenas.push({ indice: i, itens });
  }

  return cenas;
}
