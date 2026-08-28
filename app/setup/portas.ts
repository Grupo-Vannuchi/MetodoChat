// AS DECISÕES DA TELA DAS QUATRO PORTAS, FORA DO JSX.
//
// POR QUE ESTE ARQUIVO EXISTE, e a razão é medida, não estética: a suíte deste
// projeto NÃO TESTA COMPONENTE, por decisão do dono, e isso foi conferido
// plantando defeito em três telas — os testes ficaram todos verdes. Toda
// decisão que mora dentro do JSX é rede ZERO. Esta tela nasceu depois desse
// achado, então ela nasce com as decisões aqui: o JSX de `portas-de-entrada.tsx`
// mapeia e desenha, e não decide nada.
//
// A frase que fechou a discussão na fase: reintroduzir o defeito deixa de ser
// "apagar uma cláusula" e passa a ser "acrescentar um import e escrever lógica
// nova".
//
// O QUE ESTE ARQUIVO NÃO DECIDE: a regra da META (o `locale`, os corpos, o
// limite) mora em `lib/perguntas-de-abertura.ts`, e o formato do identificador
// mora em `lib/steps.ts`. Aqui só se responde o que a TELA pergunta.
import { lerPayload, payloadDaPergunta } from "@/lib/steps";
import {
  MAXIMO_DE_PERGUNTAS,
  identificadorSobrevive,
  type Pergunta,
} from "@/lib/perguntas-de-abertura";

// O que a tela sabe de cada automação da conta. Só estes quatro campos, e cada
// um responde a um aviso diferente lá embaixo.
export type AutomacaoConhecida = {
  id: string;
  name: string;
  active: boolean;
  triggers: string[];
};

// O gatilho que faz uma automação começar por toque numa pergunta de abertura.
// Escrito aqui uma vez porque tanto o aviso quanto a lista do seletor
// perguntam por ele.
export const GATILHO_DE_ABERTURA = "abertura";

// LIGAR PERGUNTA A AUTOMAÇÃO FUNCIONA HOJE?
//
// A resposta é CALCULADA a partir das duas regras que já existem, e não escrita
// à mão — é isso que faz este aviso sumir sozinho no dia em que a forma do
// identificador mudar, em vez de virar um recado velho na tela.
//
//   `payloadDaPergunta` (lib/steps.ts) emite `AUTO:<automação>`
//   `identificadorSobrevive` (lib/perguntas-de-abertura.ts) diz que a Meta NÃO
//     guarda identificador com dois-pontos — medido em 28/08/2026, com controle
//     pareado
//
// Enquanto as duas disserem isso, escolher uma automação aqui produziria uma
// pergunta que aparece para toda pessoa que abre a conversa e não dispara nada.
// A gravação recusa (`conferirPerguntas`), e esta constante é o que faz a tela
// DIZER ANTES em vez de deixar o dono descobrir no clique.
const EXEMPLO_DE_IDENTIFICADOR = payloadDaPergunta("00000000-0000-0000-0000-000000000000");

export const LIGAR_FUNCIONA = identificadorSobrevive(EXEMPLO_DE_IDENTIFICADOR);

export const AVISO_DA_LIGACAO =
  "Ligar uma pergunta a uma automação está indisponível: a Meta não guarda o identificador " +
  "que este painel usa (medido — ela aceita a chamada e devolve a pergunta sem ele). " +
  "Dá para escrever e reordenar as perguntas normalmente; o que não sai daqui, por enquanto, " +
  "é apontar uma delas para uma automação.";

export type Aviso = { texto: string; grau: "aviso" | "erro" };

// Uma posição do menu, já resolvida: o JSX escreve `linha.dispara` e
// `linha.aviso` sem perguntar mais nada.
export type Linha = {
  // 1..4 — a posição na ordem em que o Instagram exibe, que é a ordem em que a
  // Meta devolveu. Numerada a partir de 1 porque é o que a tela mostra.
  posicao: number;
  texto: string;
  // O identificador CRU, como está na Meta. Ele volta escondido no formulário
  // para que uma pergunta que este painel não entende sobreviva a um "Salvar"
  // que não a tocou — ver `perguntasDoFormulario`.
  payload: string;
  // O que preencher no seletor. `null` quando a pergunta não aponta para
  // automação nenhuma DESTA conta — inclusive quando o identificador é de
  // outro formato.
  automacaoId: string | null;
  // A frase da coluna "o que dispara".
  dispara: string;
  aviso: Aviso | null;
};

const VAZIA = "Nada — posição livre";
const SEM_AUTOMACAO = "Não dispara nada";

// O QUE CADA POSIÇÃO MOSTRA.
//
// As perguntas chegam da META, e não do banco: a Meta é a verdade porque o dono
// pode ter mexido pelo painel dela. `automacoes` é a lista da conta, e é ela
// que transforma um identificador em nome — e em aviso, quando os dois
// discordam.
//
// SEMPRE DEVOLVE PELO MENOS `MAXIMO_DE_PERGUNTAS` LINHAS, preenchendo as vagas
// com posição livre: as quatro portas são as quatro portas, e uma tela que
// mostrasse só as preenchidas esconderia justamente o que o dono veio fazer.
//
// E DEVOLVE MAIS QUE QUATRO se a Meta tiver mais que quatro. Parece impossível
// — o limite é quatro —, mas uma conta com perguntas em VÁRIOS IDIOMAS tem
// quatro por idioma, e `perguntasDaResposta` não filtra por `locale` de
// propósito. Cortar em quatro aqui esconderia perguntas que estão no ar; quem
// conta a história é `resumoDoLimite`.
export function linhasDasPortas(
  perguntas: Pergunta[],
  automacoes: AutomacaoConhecida[]
): Linha[] {
  const porId = new Map(automacoes.map((a) => [a.id, a]));
  const total = Math.max(perguntas.length, MAXIMO_DE_PERGUNTAS);
  const linhas: Linha[] = [];
  for (let i = 0; i < total; i++) {
    const p = perguntas[i];
    if (!p) {
      linhas.push({
        posicao: i + 1,
        texto: "",
        payload: "",
        automacaoId: null,
        dispara: VAZIA,
        aviso: null,
      });
      continue;
    }
    linhas.push({ posicao: i + 1, texto: p.question, payload: p.payload, ...destinoDe(p.payload, porId) });
  }
  return linhas;
}

// PARA ONDE UM IDENTIFICADOR APONTA, e o que há de errado com isso.
//
// Os cinco desfechos vêm do MOTOR (`handleMessagingEvent`, lib/engine.ts), e
// cada um é um comportamento diferente do que a pessoa que tocar vai viver.
// Escrever "aponta" ou "não aponta" só, sem separar os cinco, deixaria o dono
// com um sim/não para um problema que tem cinco causas diferentes.
function destinoDe(
  payload: string,
  porId: Map<string, AutomacaoConhecida>
): Pick<Linha, "automacaoId" | "dispara" | "aviso"> {
  const p = lerPayload(payload);
  // 1. IDENTIFICADOR DE OUTRO FORMATO — e este caso ESTÁ NO AR HOJE. As
  // perguntas de teste em produção (@vannuchi.eng, @n8xmarketing,
  // @saas.metodoia) usam `abertura-...`, escolhido de propósito para que
  // `lerPayload` devolva null e nada dispare. Elas continuam lá quando esta
  // tela passa a escrever o identificador de verdade, e mostrá-las como "não
  // aponta para automação nenhuma" é a resposta CERTA: é exatamente o que elas
  // fazem. Desarmá-las é outra tarefa.
  if (!p) {
    return {
      automacaoId: null,
      dispara: SEM_AUTOMACAO,
      aviso: {
        grau: "aviso",
        // O CONSELHO SÓ APARECE SE ELE FUNCIONAR. Mandar "escolha uma
        // automação" enquanto a ligação está bloqueada é fazer o dono
        // descobrir no clique — que é exatamente o que esta tela existe para
        // evitar com o limite de quatro.
        texto:
          "O identificador desta pergunta não é deste painel — quem tocar nela não começa automação nenhuma." +
          (LIGAR_FUNCIONA ? " Escolha uma automação para ligá-la." : ""),
      },
    };
  }
  const a = porId.get(p.automationId);
  // 2. APONTA PARA AUTOMAÇÃO QUE NÃO EXISTE MAIS NESTA CONTA. O motor sai
  // calado (`loadAutomation` não acha, `if (!auto) return`): a pessoa toca e
  // não recebe nada, sem erro em lugar nenhum. Vermelho, porque alguém deixou
  // de receber mensagem.
  if (!a) {
    return {
      automacaoId: null,
      dispara: SEM_AUTOMACAO,
      aviso: {
        grau: "erro",
        texto:
          "Esta pergunta aponta para uma automação que não existe mais nesta conta. Quem tocar nela não recebe nada.",
      },
    };
  }
  // 3. AUTOMAÇÃO PAUSADA. `loadAutomation` exige `active = true`, então o
  // desfecho é o mesmo do caso acima — silêncio —, mas a causa é outra e o
  // conserto é de um clique.
  if (!a.active) {
    return {
      automacaoId: a.id,
      dispara: a.name,
      aviso: {
        grau: "erro",
        texto: `A automação “${a.name}” está pausada. Quem tocar nesta pergunta não recebe nada até você ativá-la.`,
      },
    };
  }
  // 4. GATILHO TROCADO. O motor executa assim mesmo — de propósito, para que
  // uma pergunta que está no ar não pare em silêncio — e registra
  // `abertura_com_gatilho_trocado` em Atividade. Âmbar: nada quebrou, e o que
  // há é a configuração dizendo uma coisa e a Meta dizendo outra.
  if (!a.triggers.includes(GATILHO_DE_ABERTURA)) {
    return {
      automacaoId: a.id,
      dispara: a.name,
      aviso: {
        grau: "aviso",
        texto: `A automação “${a.name}” não está com o gatilho “pergunta de abertura”. Ela roda mesmo assim, e a divergência aparece em Atividade.`,
      },
    };
  }
  // 5. TUDO CERTO.
  return { automacaoId: a.id, dispara: a.name, aviso: null };
}

export type Resumo = {
  usadas: number;
  maximo: number;
  livres: number;
  cheio: boolean;
  acima: boolean;
  texto: string;
};

// O LIMITE DE QUATRO É DA CONTA, E A TELA TEM DE DEIXAR ISSO ÓBVIO.
//
// Não é por automação e não é escolha deste produto: é da Meta, e vale para a
// conta inteira. O caminho errado é o dono descobrir isso no 400 da Meta ao
// tentar a quinta — por isso a contagem fica escrita na tela, com o número
// vindo de `MAXIMO_DE_PERGUNTAS` e não digitado aqui.
//
// O CASO "ACIMA DO LIMITE" NÃO É HIPOTÉTICO: uma conta com perguntas em vários
// idiomas devolve quatro por idioma. Ele existe para a tela não afirmar
// "0 livres" quando a verdade é "sobrando".
export function resumoDoLimite(usadas: number): Resumo {
  const maximo = MAXIMO_DE_PERGUNTAS;
  const livres = Math.max(0, maximo - usadas);
  const acima = usadas > maximo;
  const texto = acima
    ? `${usadas} perguntas configuradas nesta conta, acima do limite de ${maximo}. Salvar por aqui só vai passar com ${maximo} ou menos.`
    : usadas === 0
      ? `Nenhuma pergunta configurada. Esta conta tem ${maximo} posições no total.`
      : `${usadas} de ${maximo} posições usadas nesta conta` +
        (livres === 0 ? " — não cabe mais nenhuma." : `, ${livres} ${livres === 1 ? "livre" : "livres"}.`);
  return { usadas, maximo, livres, cheio: livres === 0 && !acima, acima, texto };
}

// Uma linha como o formulário a devolve. `automacaoId` vazio é "nenhuma"
// escolhida no seletor; `payload` é o que veio da Meta, intacto.
export type LinhaDoFormulario = { texto: string; automacaoId: string; payload: string };

// DO FORMULÁRIO PARA A META.
//
// Devolve `{ perguntas }` na ordem das posições, ou `{ motivo }` em português.
//
// TRÊS DECISÕES MORAM AQUI, e nenhuma delas é óbvia o bastante para ficar solta
// no JSX:
//
// 1. LINHA EM BRANCO SOME. Apagar o texto de uma posição é como se tira uma
//    pergunta do ar — não há botão de remover separado, e não precisa haver.
//
// 2. QUEM ESCOLHEU AUTOMAÇÃO GANHA O IDENTIFICADOR DE VERDADE
//    (`payloadDaPergunta`, lib/steps.ts). É esta linha que liga a pergunta à
//    automação, e é a única escritora deste formato na tela.
//
// 3. QUEM NÃO ESCOLHEU FICA COM O IDENTIFICADOR QUE JÁ ESTAVA LÁ. É o que
//    protege as perguntas antigas de produção: elas usam `abertura-...`, este
//    painel não as entende, e um "Salvar" feito para mexer em OUTRA posição não
//    pode reescrevê-las nem apagá-las por tabela. Sem esta linha, salvar a tela
//    apagaria três perguntas que estão no ar em três contas.
//
// E O QUE ELA RECUSA: texto sem identificador nenhum — nem escolhido nem
// herdado. Aceitar seria pôr no ar uma pergunta que não responde ao toque, que
// é o defeito mais caro desta tela, porque ele só aparece na conversa de quem
// tocou.
export function perguntasDoFormulario(linhas: LinhaDoFormulario[]): {
  perguntas?: Pergunta[];
  motivo?: string;
} {
  const perguntas: Pergunta[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    const texto = l.texto.trim();
    const automacaoId = l.automacaoId.trim();
    const herdado = l.payload.trim();
    if (!texto) {
      // Escolheu automação e apagou o texto: é ambíguo demais para adivinhar —
      // pode ser "queria remover" ou "esqueci de escrever" —, e o silêncio
      // custaria uma posição desaparecida sem aviso.
      if (automacaoId) {
        return {
          motivo: `A posição ${i + 1} tem uma automação escolhida e nenhum texto. Escreva a pergunta ou tire a automação.`,
        };
      }
      continue;
    }
    const payload = automacaoId ? payloadDaPergunta(automacaoId) : herdado;
    if (!payload) {
      return {
        motivo: `A pergunta “${texto}” precisa apontar para uma automação — sem isso, quem tocar nela não recebe nada.`,
      };
    }
    perguntas.push({ question: texto, payload });
  }
  return { perguntas };
}

// AS AUTOMAÇÕES QUE O SELETOR OFERECE, e por que ele oferece TODAS.
//
// Oferecer só as de gatilho `abertura` parecia mais limpo e é a armadilha: o
// motor NÃO confere gatilho ao entrar por identificador (é a regra escrita de
// `handleMessagingEvent`), então uma automação de outro gatilho apontada por
// engano continuaria disparando — e não estaria na lista para o dono
// desapontar. A lista mostra todas e MARCA as que divergem, no mesmo texto que
// o aviso da linha usa.
export type OpcaoDeAutomacao = { id: string; rotulo: string };

export function opcoesDeAutomacao(automacoes: AutomacaoConhecida[]): OpcaoDeAutomacao[] {
  return automacoes.map((a) => ({
    id: a.id,
    rotulo:
      a.name +
      (a.active ? "" : " (pausada)") +
      (a.triggers.includes(GATILHO_DE_ABERTURA) ? "" : " (sem o gatilho de abertura)"),
  }));
}
