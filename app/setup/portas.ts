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
import { PAYLOAD_SEM_AUTOMACAO, lerPayload, payloadDaPergunta } from "@/lib/steps";
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

// LIGAR PERGUNTA A AUTOMAÇÃO FUNCIONA HOJE? HOJE, SIM — E ESTA LINHA NÃO FOI
// EDITADA PARA ISSO.
//
// A resposta é CALCULADA a partir das duas regras que já existem, e não escrita
// à mão. Era `false` quando esta tela nasceu, e virou `true` sozinha quando
// `payloadDaPergunta` (lib/steps.ts) trocou de forma — nenhuma linha deste
// arquivo nem do JSX mudou, e o aviso da tela sumiu junto. É exatamente para
// isso que ela é derivada, e o teste que afirma a derivação
// (`tests/setup-portas.test.ts`) é o mesmo de antes.
//
//   `payloadDaPergunta` (lib/steps.ts) emite `ABERTURA_<automação>` — a QUARTA
//     forma, acrescentada ao lado das três com dois-pontos, que continuam
//     lidas exatamente como eram
//   `identificadorSobrevive` (lib/perguntas-de-abertura.ts) diz que a Meta NÃO
//     guarda identificador com `:` nem com `|` — medido em 28/08/2026, com
//     controle pareado, e a forma nova sobrevive
//
// E ELA CONTINUA AQUI DEPOIS DE VIRAR VERDADE, o que não é sobra. O caminho de
// volta é real: alguém pode mudar a forma outra vez, ou a Meta pode passar a
// comer outro caractere, e nesse dia a recusa e o aviso voltam sozinhos pelo
// mesmo mecanismo que os tirou. Apagar isto agora seria trocar uma regra
// derivada por uma suposição de que o problema não volta.
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
  // 0. A PERGUNTA QUE O DONO ESCOLHEU NÃO LIGAR A NADA. Ela é o caso que a spec
  // nomeia ("uma pergunta que o dono responde à mão — e ainda assim vale estar
  // no menu"), e por isso ela sai ANTES do ramo 1: os dois têm `lerPayload`
  // nulo, mas este é uma ESCOLHA e aquele é uma pergunta que o painel não
  // reconhece. Marcá-la com o aviso do ramo 1 seria a tela repreendendo o dono
  // por ter feito o que a tela ofereceu.
  if (payload === PAYLOAD_SEM_AUTOMACAO) {
    return { automacaoId: null, dispara: SEM_AUTOMACAO, aviso: null };
  }
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

// ============================================================
// A COSTURA DE NOMES ENTRE A TELA E A AÇÃO, E POR QUE ELA MORA AQUI.
//
// Um formulário HTML liga as duas pontas por STRING: o JSX escreve
// `name="texto-3"` e a ação do servidor pede `formData.get("texto-3")`. As duas
// pontas moram em arquivos diferentes, ninguém as confere, e um `s` a mais de um
// lado não é erro de tipo nem de lint — é um campo que volta VAZIO.
//
// O QUE ISSO CUSTA, e é medido: com os quatro nomes de texto desencontrados,
// toda linha lida volta em branco, `perguntasDoFormulario` devolve `[]`,
// `acaoDaEscrita` traduz lista vazia em DELETE (é o pedido legítimo de "quero
// ficar sem pergunta nenhuma"), e a Meta apaga o campo `ice_breakers` INTEIRO da
// conta. A tela então redireciona dizendo "ficou sem pergunta de abertura
// nenhuma ✓". As quatro portas somem do perfil público e o painel comemora.
//
// CINCO DESENCONTROS DESTES FORAM PLANTADOS e passaram por `tsc`, por `eslint`,
// pelos 805 puros e pelos 56 de integração — todos verdes, os cinco. Não era
// defeito presente: era rede ZERO sobre a única peça nova da branch que ainda
// tinha decisão de fiação dentro do JSX.
//
// A SAÍDA É A MESMA DAS OUTRAS QUATRO VEZES DESTA FASE: a decisão sai do JSX.
// Aqui a "decisão" é a lista de campos que o formulário tem — quantos são, como
// se chamam e o que vai em cada um —, e ela passa a ser um VALOR
// (`formularioDasPortas`) que o JSX só desenha. Do outro lado,
// `linhasDoFormulario` lê pelos MESMOS construtores de nome. As duas pontas
// deixam de combinar por coincidência e passam a combinar por construção, e o
// que sobra — o desencontro assimétrico, alguém escrevendo o nome à mão de um
// lado só — cai no teste de ida e volta de `tests/setup-portas.test.ts`.
// ============================================================

export const CAMPO_CONTA = "conta";
export const CAMPO_POSICOES = "posicoes";

// OS TRÊS CONSTRUTORES DE NOME, e eles são a costura inteira. Trocar um deles
// troca as DUAS pontas ao mesmo tempo, que é justamente o que faz a troca ser
// inofensiva; o que quebra é escrever o nome à mão de um lado só.
export function campoTexto(posicao: number): string {
  return `texto-${posicao}`;
}
export function campoAutomacao(posicao: number): string {
  return `automacao-${posicao}`;
}
export function campoPayload(posicao: number): string {
  return `payload-${posicao}`;
}

// Uma posição do formulário, já com nome e valor de cada campo. O JSX lê daqui e
// não monta nome nenhum.
export type CamposDaLinha = {
  posicao: number;
  texto: { nome: string; valor: string };
  automacao: { nome: string; valor: string };
  // O identificador que veio da Meta, escondido no formulário — E SÓ QUANDO O
  // SELETOR NÃO SABE DIZÊ-LO. Ele existe para uma pergunta que este painel não
  // entende sobreviver a um "Salvar" que não a tocou; para as que ele entende, o
  // seletor reconstrói o identificador sozinho, e mandar os dois faria a herança
  // vencer a escolha do dono — "Nenhuma automação" viraria um clique que não
  // desliga nada. Ver a regra 4 de `perguntasDoFormulario`.
  payload: { nome: string; valor: string };
  dispara: string;
  aviso: Aviso | null;
};

export type Formulario = {
  conta: { nome: string; valor: string };
  // QUANTAS POSIÇÕES ESTE FORMULÁRIO MANDOU, e ele é o que diz ao outro lado até
  // onde contar. Normalmente quatro; pode ser mais numa conta com perguntas em
  // vários idiomas, e aí a tela mostra todas em vez de esconder o que está no
  // ar. Fixá-lo em `MAXIMO_DE_PERGUNTAS` faria o "Salvar" dessa conta apagar
  // calado tudo que passasse da quarta.
  posicoes: { nome: string; valor: string };
  linhas: CamposDaLinha[];
};

export function formularioDasPortas(igUserId: string, linhas: Linha[]): Formulario {
  return {
    conta: { nome: CAMPO_CONTA, valor: igUserId },
    posicoes: { nome: CAMPO_POSICOES, valor: String(linhas.length) },
    linhas: linhas.map((l) => ({
      posicao: l.posicao,
      texto: { nome: campoTexto(l.posicao), valor: l.texto },
      automacao: { nome: campoAutomacao(l.posicao), valor: l.automacaoId ?? "" },
      payload: { nome: campoPayload(l.posicao), valor: l.automacaoId ? "" : l.payload },
      dispara: l.dispara,
      aviso: l.aviso,
    })),
  };
}

// O TETO DO LAÇO DE LEITURA. Ele existe para o servidor não repetir um número
// que veio do navegador: quatro é o limite da Meta, e o dobro cobre a conta
// multi-idioma, que é o caso em que a tela desenha mais de quatro posições.
export const TETO_DE_POSICOES = 2 * MAXIMO_DE_PERGUNTAS;

// O que `linhasDoFormulario` precisa de um `FormData`, e nada além disso. O tipo
// estreito é o que permite testar a leitura com um `FormData` de verdade sem
// arrastar `next/server` para dentro de um teste puro.
export type LeitorDeCampos = { get(nome: string): unknown };

function textoDoCampo(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

export function contaDoFormulario(dados: LeitorDeCampos): string {
  return textoDoCampo(dados.get(CAMPO_CONTA)).trim();
}

// DO `FormData` PARA AS LINHAS, e a recusa que este caminho precisa ter.
//
// FORMULÁRIO SEM `posicoes` LEGÍVEL É RECUSADO, E NÃO VIRA "ZERO POSIÇÕES".
// Medido: `Number("abc")` é `NaN`, e `Math.min(Math.max(0, NaN), 8)` também é
// `NaN` — o laço rodava zero vezes, a lista saía vazia, e o "Salvar" virava o
// DELETE do campo inteiro anunciado com ✓. Zero posições NUNCA é um formulário
// desta tela: `linhasDasPortas` devolve pelo menos `MAXIMO_DE_PERGUNTAS` linhas,
// sempre. Um formulário que não diz quantas posições tem é um formulário que
// não entendemos, e a resposta certa para o que não se entende não pode ser
// apagar as quatro portas da conta.
//
// (Só é alcançável por formulário adulterado — a ação está atrás da sessão do
// painel. A guarda existe precisamente para não confiar no navegador.)
export function linhasDoFormulario(dados: LeitorDeCampos): {
  linhas?: LinhaDoFormulario[];
  motivo?: string;
} {
  const bruto = textoDoCampo(dados.get(CAMPO_POSICOES)).trim();
  const n = Number(bruto);
  if (!bruto || !Number.isInteger(n) || n < 1) {
    return {
      motivo:
        "Não deu para ler o formulário: ele não disse quantas posições mandou. " +
        "Recarregue a Configuração e tente de novo — nada foi alterado.",
    };
  }
  const posicoes = Math.min(n, TETO_DE_POSICOES);
  const linhas: LinhaDoFormulario[] = [];
  for (let p = 1; p <= posicoes; p++) {
    linhas.push({
      texto: textoDoCampo(dados.get(campoTexto(p))),
      automacaoId: textoDoCampo(dados.get(campoAutomacao(p))),
      payload: textoDoCampo(dados.get(campoPayload(p))),
    });
  }
  return { linhas };
}

// ============================================================
// O RASCUNHO: O QUE O DONO TINHA ESCRITO QUANDO A GRAVAÇÃO RECUSOU.
//
// A ação responde a toda recusa com `redirect("/setup?erro=…")`, e a tela recarrega
// DA META. Sem isto, o dono que reescreve as quatro perguntas e erra uma delas
// perde as outras três: ele lê o motivo do erro numa tela que já voltou ao que
// estava antes, e nem sempre percebe que perdeu.
//
// AS PORTAS PELAS QUAIS ISSO ACONTECE NÃO SÃO HIPOTÉTICAS: a posição com
// automação escolhida e texto apagado; a conta multi-idioma, que tem mais de
// quatro perguntas e é recusada por `conferirPerguntas`; e toda recusa da META
// — HTTP diferente de 200, ou pergunta que não ficou como foi mandada.
//
// POR QUE PELA URL, e não por estado de formulário: esta tela é um Server
// Component dentro de um `<Suspense>` que espera a Meta responder. Transformá-la
// em componente de cliente com `useActionState` para carregar o rascunho traria
// de volta ao JSX exatamente o tipo de decisão que este arquivo existe para
// tirar de lá.
//
// O QUE CHEGA AQUI É TEXTO DE URL, e portanto NÃO É CONFIÁVEL: `lerRascunho`
// trata tudo como suspeito — JSON quebrado, formato errado, campo que não é
// string, lista gigante — e devolve `null` para qualquer coisa que não seja
// exatamente o esperado. `null` faz a tela desenhar o que a Meta diz, que é o
// comportamento de sempre.
// ============================================================
export type Rascunho = { conta: string; linhas: LinhaDoFormulario[] };

// O TETO DA URL. Um `Location` de cabeçalho não é lugar para carga arbitrária, e
// um rascunho que não cabe é melhor perdido do que virando um redirecionamento
// que o servidor da frente recusa — o dono veria um erro de infraestrutura no
// lugar do motivo da recusa.
const LIMITE_DO_RASCUNHO = 4000;
const LIMITE_DO_CAMPO = 1000;

export function escreverRascunho(conta: string, linhas: LinhaDoFormulario[]): string | null {
  const texto = JSON.stringify({ conta, linhas } satisfies Rascunho);
  return texto.length > LIMITE_DO_RASCUNHO ? null : texto;
}

function campoDoRascunho(valor: unknown): string | null {
  if (typeof valor !== "string" || valor.length > LIMITE_DO_CAMPO) return null;
  return valor;
}

export function lerRascunho(bruto: unknown): Rascunho | null {
  if (typeof bruto !== "string" || !bruto) return null;
  let json: unknown;
  try {
    json = JSON.parse(bruto);
  } catch {
    return null;
  }
  const r = (json ?? {}) as { conta?: unknown; linhas?: unknown };
  const conta = campoDoRascunho(r.conta);
  if (!conta || !Array.isArray(r.linhas) || r.linhas.length > TETO_DE_POSICOES) return null;
  const linhas: LinhaDoFormulario[] = [];
  for (const item of r.linhas) {
    const l = (item ?? {}) as Partial<LinhaDoFormulario>;
    const texto = campoDoRascunho(l.texto);
    const automacaoId = campoDoRascunho(l.automacaoId);
    const payload = campoDoRascunho(l.payload);
    if (texto === null || automacaoId === null || payload === null) return null;
    linhas.push({ texto, automacaoId, payload });
  }
  return { conta, linhas };
}

// AS LINHAS QUE A TELA DESENHA DEPOIS DE UMA RECUSA.
//
// O rascunho é de UMA conta, e a tela desenha todas as conectadas: sem a
// conferência de `conta`, o "Salvar" recusado de `@vannuchi.eng` reescreveria a
// tela de `@thiagovannuchi` com as perguntas da primeira.
//
// O IDENTIFICADOR DE CADA LINHA É RECALCULADO POR `payloadDaLinha`, a MESMA
// função que a gravação usa. Redesenhar com outra regra faria a tela mostrar um
// destino e o "Salvar" seguinte escrever outro — que é a doença que este achado
// fechou.
export function linhasComRascunho(
  linhasDaMeta: Linha[],
  automacoes: AutomacaoConhecida[],
  rascunho: Rascunho | null,
  igUserId: string
): Linha[] {
  if (!rascunho || rascunho.conta !== igUserId) return linhasDaMeta;
  const porId = new Map(automacoes.map((a) => [a.id, a]));
  const total = Math.max(rascunho.linhas.length, MAXIMO_DE_PERGUNTAS);
  const linhas: Linha[] = [];
  for (let i = 0; i < total; i++) {
    const l = rascunho.linhas[i];
    const texto = l?.texto ?? "";
    const automacaoId = l?.automacaoId ?? "";
    const herdado = l?.payload ?? "";
    // Posição que o dono deixou em branco por completo: livre, como a Meta a
    // desenharia. Não vira "pergunta sem automação" — ela não é pergunta
    // nenhuma, e `perguntasDoFormulario` a descarta pelo mesmo motivo.
    if (!texto.trim() && !automacaoId) {
      linhas.push({
        posicao: i + 1,
        texto,
        payload: herdado,
        automacaoId: null,
        dispara: VAZIA,
        aviso: null,
      });
      continue;
    }
    const payload = payloadDaLinha(automacaoId, herdado);
    linhas.push({ posicao: i + 1, texto, payload, ...destinoDe(payload, porId) });
  }
  return linhas;
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
// 3. QUEM NÃO ESCOLHEU FICA COM O IDENTIFICADOR QUE JÁ ESTAVA LÁ, quando esse
//    identificador NÃO É DESTE PAINEL. É o que protege as perguntas antigas de
//    produção: elas usam `abertura-...`, este painel não as entende, e um
//    "Salvar" feito para mexer em OUTRA posição não pode reescrevê-las nem
//    apagá-las por tabela. Sem esta linha, salvar a tela apagaria três
//    perguntas que estão no ar em três contas.
//
// 4. E "NENHUMA AUTOMAÇÃO" NUMA PERGUNTA QUE O SELETOR REPRESENTA DESLIGA
//    MESMO. Quem separa este caso da regra 3 não é uma condição aqui: é o
//    FORMULÁRIO. `formularioDasPortas` só manda o identificador herdado das
//    linhas que o seletor NÃO consegue representar — as outras o seletor
//    reconstrói sozinho, e mandar as duas coisas faria a herança vencer a
//    escolha. Sem isso, o dono põe o seletor em "Nenhuma automação", salva, e a
//    pergunta continua ligada: a tela oferecendo o que o salvar desfaz calado.
//
// O QUE ELA NÃO RECUSA MAIS: a pergunta que não dispara automação nenhuma. A
// spec a nomeia — "'Quais são os valores?' pode ser só uma pergunta que o dono
// responde à mão, e ainda assim vale estar no menu" —, o seletor OFERECE
// "Nenhuma automação" e a coluna imprime "Não dispara nada" para as que já
// existem. Recusar era a tela oferecer o que o salvar nega, que é a mesma
// doença que esta branch fechou na paleta (`salvarRecusaOBloco`). Ela passa a
// ganhar `PAYLOAD_SEM_AUTOMACAO` (lib/steps.ts): um identificador que existe —
// a Meta exige um —, sobrevive ao `messenger_profile` e não é lido como nada
// pelo motor.
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
    perguntas.push({ question: texto, payload: payloadDaLinha(automacaoId, herdado) });
  }
  return { perguntas };
}

// As regras 2, 3 e 4 acima, numa decisão só — e ela é a mesma que
// `linhasComRascunho` usa para redesenhar a tela depois de uma recusa, para que
// o dono não veja uma coisa e o salvar faça outra.
export function payloadDaLinha(automacaoId: string, herdado: string): string {
  if (automacaoId) return payloadDaPergunta(automacaoId);
  return herdado || PAYLOAD_SEM_AUTOMACAO;
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
