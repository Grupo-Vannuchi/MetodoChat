"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getSelectedAccountId } from "@/lib/account";
import { conferirLista, ligacoesValidas, podeFicarAtiva } from "@/lib/steps";

function splitList(raw: string, sep: RegExp): string[] {
  return raw
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

// O que o salvar devolve. Ele NÃO redireciona: o quadro é uma tela em que se
// salva várias vezes seguidas, e mandar a pessoa embora a cada gravação era o
// comportamento do formulário, que tinha um botão só no fim.
//
// `pausada` É A TAREFA 6b: quando presente, o que foi gravado saiu diferente
// do que a caixa "Ativa" pedia — o dono marcou ativa, ou já estava ativa, e
// `podeFicarAtiva` (lib/steps.ts) recusou. O valor é a MESMA frase que
// `conferirLista` produz para o erro de ativar que causou a recusa, a mesma
// que o botão "Ativar" mostraria: duas frases diferentes para o mesmo
// problema é a doença que esta fase passou sete comentários curando.
type Resultado = { ok: true; pausada?: string } | { ok: false; erro: string };

const GATILHOS = ["comment", "story", "dm"];
const CORRESPONDENCIAS = ["contains", "exact", "any"];

// NADA AQUI É EXPORTADO ALÉM DE FUNÇÃO ASSÍNCRONA, e isso não é estilo: este
// arquivo tem `"use server"` no topo, e no Next.js 16 (Turbopack) TODA
// exportação de um arquivo `"use server"` é tratada como Server Action,
// obrigada a ser assíncrona ("Server Actions must be async functions."). É por
// isso que `Resultado` fica sem `export` e que `novoIdDeBloco` mora em
// `lib/steps.ts` — aquele arquivo não tem a diretiva, e é justamente por isso
// que ele pode exportar a mesma função para os dois lados.

// O post ou story escolhido no painel do gatilho, normalizado. Devolve null para
// qualquer coisa que não tenha a forma esperada — é dado do navegador.
function midiaEscolhida(v: unknown): { id: string; thumb: string; caption: string } | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Record<string, unknown>;
  const id = String(m.id ?? "");
  if (!id) return null;
  return { id, thumb: String(m.thumb ?? ""), caption: String(m.caption ?? "") };
}

// A mensagem que a automação inexistente (ou de outra conta) produz. Fica numa
// constante porque ela é LANÇADA de dentro da transação para desfazê-la, e
// reconhecida por igualdade do lado de fora — comparar textos escritos duas
// vezes é como as duas cópias passam a divergir.
const NAO_ENCONTRADA = "Automação não encontrada.";

// ---------------------------------------------------------------------------
// SALVAR É UM SÓ, E ELE É UMA TRANSAÇÃO — e essa é a decisão mais importante
// deste arquivo.
//
// `montarPassos` e `saveAutomation` MORRERAM AQUI, junto com `form.tsx`. Elas
// eram uma escrita só: liam as vinte e oito colunas do formulário, REGRAVAVAM
// `steps` a partir delas e redirecionavam. Chamar aquilo com o quadro montado
// apagaria a lista de blocos — a lista virava o que as colunas antigas
// descreviam, numa ordem fixa escrita em código. Nada disso volta: esta função
// grava a lista COMO ELA VEIO do quadro, e não a deduz de coluna nenhuma.
//
// O QUE MORREU AGORA foram `salvarPassos` e `salvarConfiguracao`, que eram DUAS
// gravações independentes, cada uma conferida contra a METADE que já estava no
// banco. Elas criavam um IMPASSE, e ele não tinha ordem que resolvesse:
//
//   CONFIGURAÇÃO PRIMEIRO — trocar o gatilho de comentário para DM apagando no
//     mesmo salvamento o bloco de resposta pública era recusado: o gatilho novo
//     era conferido contra os blocos AINDA GRAVADOS, onde o bloco incompatível
//     continuava.
//   PASSOS PRIMEIRO — acrescentar um bloco que só o gatilho NOVO executa era
//     recusado pelo mesmo motivo espelhado: a lista nova era conferida contra o
//     gatilho AINDA GRAVADO, que é o antigo.
//
// Nenhuma das duas ordens atende às duas transições, porque o problema não é a
// ordem: é conferir metade nova contra metade velha. A saída é conferir o PAR
// FINAL — os blocos que estão sendo gravados com o gatilho que está sendo
// gravado — uma vez só, e gravar as duas coisas juntas ou nenhuma.
//
// OS DOIS `update` CONTINUAM SEPARADOS NO SQL, e a separação mudou de natureza:
// ela era GARANTIA (com duas escritas soltas, escopos disjuntos impediam que um
// salvar parcial deixasse metade de cada coisa no banco) e agora é LEITURA. A
// transação já torna o salvar parcial impossível; manter um `update` que toca só
// `steps` e outro que toca só as colunas do gatilho é o que deixa visível, na
// hora de ler, o que cada escrita escreve. Juntá-los num `update` só não
// quebraria nada — só apagaria essa divisão.
//
// A CONFERÊNCIA DO SERVIDOR É A RAZÃO DE ISTO SER UM SERVER ACTION. O cliente já
// conferiu, para desabilitar o botão; o cliente é o navegador da pessoa e nada
// que vem de lá é confiável. É a MESMA função (`conferirLista`, lib/steps.ts)
// nos dois lados — escrever a regra duas vezes é como as duas versões passam a
// discordar. E ela roda sobre o par que ESTÁ SENDO GRAVADO, que é justamente o
// par de que o motor vai depender depois.
//
// O QUE A CONFERÊNCIA DO PAR DESFEZ: a comparação "só os erros que a MUDANÇA de
// gatilho introduz", que existia em `salvarConfiguracao`. Ela era necessária
// enquanto aquela ação escrevia METADE do par — sem ela, um erro antigo na lista
// (o "link sem endereço" do legado) trancaria até a troca do nome, e esse erro
// não era daquela escrita. Aqui a escrita é o par inteiro, então todo erro do
// resultado É desta escrita, e recusá-los é o mesmo critério que o botão Salvar
// do quadro já aplica.
//
// A configuração, a lista e as setas chegam como `unknown` de propósito: as três
// vêm do estado de um componente de cliente, e assinatura tipada daria a
// impressão de uma garantia que o POST direto no Server Action não tem.
//
// O QUE ESTA FUNÇÃO NÃO ESCREVE são as vinte e oito colunas do formulário antigo
// (`welcome_text`, `link_url`, `require_follow`, …): elas viraram blocos, o
// motor não as lê mais, e regravá-las aqui seria manter viva uma segunda
// descrição do mesmo fluxo — a que já divergiu uma vez.
//
// O QUE ELA PASSOU A ESCREVER, na Tarefa 6, é `ligacoes`. O quadro é quem desenha
// as setas, e até aqui elas só chegavam ao banco pela migração
// (`scripts/ligar-passos-existentes.mjs`). O `select ligacoes` que esta função
// fazia — para conferir o par final contra as setas gravadas — saiu no mesmo
// commit, e o porquê está no lugar em que ele estava.
// ---------------------------------------------------------------------------
export async function salvarAutomacao(
  automationId: string,
  passos: unknown,
  ligacoesRecebidas: unknown,
  configuracao: unknown
): Promise<Resultado> {
  await ensureSchema();
  const accountId = await getSelectedAccountId();
  if (!accountId) return { ok: false, erro: "Nenhuma conta conectada." };

  const c = (configuracao ?? {}) as Record<string, unknown>;
  const nome = String(c.nome ?? "").trim();
  const ativo = Boolean(c.ativo);
  const gatilho = String(c.gatilho ?? "");
  const correspondencia = String(c.correspondencia ?? "");
  const palavras = Array.isArray(c.palavras)
    ? c.palavras.map((p) => String(p).trim()).filter(Boolean)
    : [];
  // A DECISÃO DO DONO SOBRE ESTE FLUXO, da Tarefa 9. `Boolean` pelo mesmo motivo
  // dos outros campos desta função: `configuracao` chega como `unknown` porque
  // vem do estado de um componente de cliente, e o POST direto no Server Action
  // pode mandar qualquer coisa aqui. Tudo que não for verdadeiro vira `false`,
  // que é o lado seguro — a regra do portão contornável continua impedindo
  // publicar.
  const entregaSemPortao = Boolean(c.entregaSemPortao);

  if (!GATILHOS.includes(gatilho)) return { ok: false, erro: "Escolha o gatilho da automação." };
  if (!CORRESPONDENCIAS.includes(correspondencia))
    return { ok: false, erro: "Escolha o tipo de correspondência." };
  if (!nome) return { ok: false, erro: "Dê um nome à automação." };
  if (correspondencia !== "any" && !palavras.length)
    return { ok: false, erro: "Informe as palavras-chave (ou mude para “Qualquer texto”)." };

  // Post e story só valem no gatilho correspondente — é a mesma regra que o
  // painel aplica ao trocar o gatilho, repetida aqui porque o painel é cliente.
  // Sem ela, um post escolhido continuaria preso a uma automação que passou a
  // ser disparada por story, e `findMatch` (lib/engine.ts) usa essas colunas
  // para decidir qual automação ganha.
  const post = gatilho === "comment" ? midiaEscolhida(c.post) : null;
  const story = gatilho === "story" ? midiaEscolhida(c.story) : null;

  // AS SETAS CHEGAM POR ARGUMENTO, e é a Tarefa 6 que as põe aqui.
  //
  // ELAS VINHAM DO BANCO, por um `select ligacoes` que existia neste lugar com a
  // data de saída escrita: enquanto o quadro não tinha as ligações no estado, não
  // havia metade NOVA de setas, e a metade final do par era mesmo a que já estava
  // gravada. Agora há — o quadro desenha, liga e parte setas —, então a lista que
  // chegou é a metade final, e a do banco é a metade velha. Conferir contra ela
  // seria exatamente o erro que a fusão de `salvarPassos` com `salvarConfiguracao`
  // desfez, com outro nome.
  //
  // O `select` SAIU JUNTO. Ele era uma ida ao banco a mais por salvamento, e
  // seria pior do que inútil: leria o valor que este mesmo salvamento vai
  // sobrescrever.
  //
  // `ligacoesValidas` (lib/steps.ts) é a peneira, e ela é a mesma que o quadro
  // usa ao abrir. Nada do que vem do navegador é confiável: sem ela, uma seta
  // sem destino (ou com uma condição que não existe) entraria em `ligacoes` pelo
  // POST direto, e `ligacoesDe` a descartaria em silêncio na hora de caminhar —
  // um desenho gravado que o motor não percorre, sem nada acusando. Peneirada
  // aqui, o que é gravado é exatamente o que a conferência julgou.
  const ligacoes = ligacoesValidas(ligacoesRecebidas);

  // A CONFERÊNCIA DO PAR FINAL, UMA VEZ SÓ: os blocos, as setas e o gatilho que
  // vão ser gravados, conferidos uns contra os outros. As três metades são as
  // três que esta função escreve, então não sobra nada de velho a que comparar.
  //
  // A CHAVE ENTRA NA MESMA CHAMADA, e ela é o quarto pedaço deste par: a
  // conferência tem que julgar a lista contra a decisão que ESTE salvamento
  // grava, e não contra a que está no banco. Julgar contra a gravada faria o
  // dono desmarcar a caixa, salvar, e a automação continuar publicável por um
  // salvamento — o mesmo erro que o `select ligacoes` desta função cometia e que
  // saiu na Tarefa 6, com outro nome.
  const problemas = conferirLista(passos, gatilho, ligacoes, entregaSemPortao);

  // SÓ OS ERROS DE SALVAR TRAVAM O SALVAR, e essa é a decisão de produto da
  // Tarefa 5. O outro nível — botão sem destino, bloco ainda solto no quadro,
  // portão sem saída — descreve um desenho PELA METADE, que é o estado normal
  // de quem está montando: montar um menu de três opções, ligar duas e voltar
  // amanhã é trabalho normal, e recusar a gravação disso deixaria o dono sem
  // onde guardar o meio do trabalho.
  const erros = problemas.filter((p) => p.nivel === "erro" && p.quando === "salvar");
  if (erros.length) return { ok: false, erro: erros[0].mensagem };

  // ---------------------------------------------------------------------
  // A TAREFA 6b: A CAIXA "ATIVA" PARA DE DRIBLAR A CONFERÊNCIA DE ATIVAR.
  //
  // Até aqui, o `active` gravado era `ativo` cru — o que a caixa do painel do
  // gatilho pedia. `toggleAutomation` (mais abaixo) recusa os dois níveis de
  // `conferirLista` antes de publicar; esta função só recusava um. Como o
  // dono marca "Ativa" e clica em Salvar no MESMO painel, dava para publicar
  // um botão sem destino, um bloco inalcançável ou um portão contornável sem
  // nunca passar pela porta que `toggleAutomation` construiu.
  //
  // `podeFicarAtiva` (lib/steps.ts) faz a MESMA PERGUNTA que aquela porta faz
  // — "há algum erro de `quando: 'ativar'` no par que vai ser gravado?" —,
  // mas as duas não são a mesma checagem: `toggleAutomation` filtra só
  // `p.nivel === "erro"`, sem filtrar por `quando`. Elas dão a mesma resposta
  // AQUI porque `erros`, acima, já filtrou e teria retornado por qualquer
  // erro de `quando: "salvar"` — do que sobra em `problemas`, só o de
  // `quando: "ativar"` importa, que é exatamente o que `podeFicarAtiva`
  // pergunta. Se um dos dois filtros mudar sozinho, a equivalência some. E o
  // `active` gravado passa a ser essa resposta combinada com o que foi
  // pedido: só fica ativa se as duas coisas forem verdade.
  //
  // VALE PARA OS DOIS CASOS que o dono do produto decidiu cobrir com a mesma
  // regra: marcar "Ativa" numa automação pausada que tem um erro de ativar, e
  // salvar uma edição que introduz um erro de ativar numa automação que JÁ
  // estava ativa — `ativo`, aqui, é o que a caixa mostra no momento do clique,
  // e ela reflete o `active` gravado quando o dono não a tocou.
  //
  // NÃO RECUSA O SALVAR: seria hostil, e pior aqui do que na Tarefa 5 — o dono
  // que acabou de quebrar uma automação viva ficaria preso com a versão
  // quebrada NO AR até consertar tudo. Gravar pausada protege quem recebe e
  // não trava quem monta.
  const podeAtivar = podeFicarAtiva(problemas);
  const ativoGravado = ativo && podeAtivar;

  try {
    await sql().begin(async (tx) => {
      // ESCOPO 1 — SÓ O DESENHO: `steps` e `ligacoes`. Os dois JUNTOS, e não em
      // dois `update`, porque eles são um par: uma seta aponta para um bloco, e
      // gravar uma metade sem a outra é o estado que a conferência recusaria.
      //
      // O `returning id` faz o serviço da consulta de existência que havia
      // antes: zero linhas significa automação que não existe OU que é de outra
      // conta, e as duas dão a mesma resposta de propósito — distingui-las
      // contaria a quem tentou que aquele id existe.
      //
      // `ligacoes` vai como ARRAY CRU, igual a `passos`, e não como texto de
      // JSON. MEDIDO contra este banco, com o driver deste projeto: um
      // `select $1::jsonb` com um array de objetos devolve o jsonb certo, e com
      // `[]` devolve `[]`. Serializar à mão aqui seria uma segunda forma de
      // mandar a mesma coisa para duas colunas do mesmo tipo.
      //
      // o account_id no where impede gravar em automação de outra conta
      const linhas = (await tx.query(
        `update automations set steps = $1, ligacoes = $2, updated_at = now()
         where id = $3 and account_id = $4
         returning id`,
        [passos, ligacoes, automationId, accountId]
      )) as { id: string }[];
      // Lançar aqui é o que DESFAZ a transação. Devolver não desfaria: o `update`
      // seguinte é que ficaria de fora, e o primeiro valeria sozinho.
      if (!linhas[0]) throw new Error(NAO_ENCONTRADA);

      // ESCOPO 2 — SÓ as colunas da automação, NUNCA `steps` nem `ligacoes`.
      //
      // o account_id no where impede gravar em automação de outra conta
      await tx.query(
        `update automations set
           name = $1, active = $2, triggers = $3, keywords = $4, match_type = $5,
           media_id = $6, media_thumbnail_url = $7, media_caption = $8,
           story_id = $9, story_thumbnail_url = $10, entrega_sem_portao = $11,
           updated_at = now()
         where id = $12 and account_id = $13`,
        [
          nome,
          ativoGravado,
          [gatilho],
          palavras,
          correspondencia,
          post?.id ?? null,
          post?.thumb ?? null,
          post?.caption ?? null,
          story?.id ?? null,
          story?.thumb ?? null,
          entregaSemPortao,
          automationId,
          accountId,
        ]
      );
    });
  } catch (err) {
    if (err instanceof Error && err.message === NAO_ENCONTRADA) {
      return { ok: false, erro: NAO_ENCONTRADA };
    }
    // FALHA DO BANCO VIRA RECUSA, e não exceção que sobe. Duas razões: a
    // transação já garante que NADA foi gravado, então há uma frase honesta a
    // dizer; e uma exceção atravessando o Server Action chegaria ao quadro como
    // rejeição não tratada dentro da transição, deixando a tela sem recado
    // nenhum sobre um salvamento que não aconteceu.
    //
    // O erro de verdade vai para o log do servidor: engoli-lo aqui esconderia o
    // motivo de quem pode consertá-lo.
    console.error("[salvarAutomacao]", err);
    return { ok: false, erro: "Não deu para salvar agora — tente de novo." };
  }

  revalidatePath("/automacoes");

  // `ativo && !podeAtivar` É A ÚNICA CONDIÇÃO EM QUE O QUE FOI GRAVADO SAIU
  // DIFERENTE DO QUE FOI PEDIDO — e é a que precisa de recado, porque uma
  // mudança de estado silenciosa é pior do que o buraco que este bloco fecha.
  // A frase devolvida é a MESMA que o erro de ativar já carrega — não uma
  // nova, escrita aqui, para o mesmo problema.
  if (ativo && !podeAtivar) {
    const motivo = problemas.find((p) => p.nivel === "erro" && p.quando === "ativar");
    return { ok: true, pausada: motivo?.mensagem ?? "" };
  }
  return { ok: true };
}

// Cria a automação com o mínimo e manda para o quadro.
//
// POR QUE CRIAR ANTES DE EDITAR: `salvarAutomacao` precisa de um id, e automação
// nova não tem. A alternativa seria segurar a lista em memória esperando um id
// aparecer — e aí o primeiro salvamento teria de criar e gravar de uma vez, com
// dois caminhos diferentes para a mesma tela.
//
// ELA NASCE PAUSADA, e isso é decisão de segurança, não pudor. `findMatch`
// (lib/engine.ts) escolhe a PRIMEIRA automação ativa cujas palavras casam. Uma
// automação nova, ativa, sem nenhum bloco e com a mesma palavra-chave de uma que
// já funciona roubaria o disparo dela e não enviaria nada — a pessoa comenta e
// não recebe coisa nenhuma, sem erro em lugar nenhum. Pausada, ela não entra na
// disputa até o dono marcar "Ativa" no painel do gatilho, que é onde ele já
// está enquanto monta o fluxo.
//
// A AUTOMAÇÃO ABANDONADA FICA NO BANCO, e isso está registrado aqui em vez de
// consertado. É consequência direta de criar antes de editar: quem fecha a aba
// logo depois de criar deixa uma linha sem bloco nenhum, e nada a recolhe — não
// há limpeza por tempo nem marca de rascunho.
//
// É inofensiva por NASCER PAUSADA, que é a mesma decisão do parágrafo acima:
// `findMatch` (lib/engine.ts) só olha automação ativa, então uma linha vazia não
// disputa palavra-chave com ninguém e não muda o que qualquer contato recebe. O
// custo é a lista de automações do dono ganhar entradas vazias que só ele
// apaga.
//
// Marcá-la como rascunho custaria uma coluna e um estado a mais em toda leitura
// da lista, para um problema que não afeta envio nenhum. Fica escrito para não
// ser descoberto como surpresa.
//
// A assinatura é a de `useActionState`: o estado anterior é a mensagem de erro,
// e devolvê-la é o que deixa o que foi digitado na tela. O formulário antigo
// redirecionava para `/automacoes?erro=…` e a pessoa perdia tudo.
export async function criarAutomacao(
  _anterior: string | null,
  formData: FormData
): Promise<string | null> {
  await ensureSchema();
  const accountId = await getSelectedAccountId();
  if (!accountId) return "Conecte uma conta do Instagram antes.";

  const nome = String(formData.get("name") ?? "").trim();
  const gatilho = String(formData.get("trigger") ?? "");
  const correspondencia = String(formData.get("match_type") ?? "contains");
  const palavras = splitList(String(formData.get("keywords") ?? ""), /,/);

  if (!GATILHOS.includes(gatilho)) return "Escolha o gatilho da automação.";
  if (!CORRESPONDENCIAS.includes(correspondencia)) return "Escolha o tipo de correspondência.";
  if (!nome) return "Dê um nome à automação.";
  if (correspondencia !== "any" && !palavras.length)
    return "Informe as palavras-chave (ou mude para “Qualquer texto”).";

  const linhas = (await sql().query(
    `insert into automations (account_id, name, active, triggers, keywords, match_type, steps)
     values ($1, $2, false, $3, $4, $5, '[]'::jsonb)
     returning id`,
    [accountId, nome, [gatilho], palavras, correspondencia]
  )) as { id: string }[];

  revalidatePath("/automacoes");
  // `redirect` lança uma exceção de controle de fluxo: nada depois dele roda, e
  // é por isso que o `revalidatePath` vem antes.
  redirect(`/automacoes/${linhas[0].id}`);
}

// ---------------------------------------------------------------------------
// ATIVAR PASSA PELA MESMA CONFERÊNCIA DO SALVAR; DESLIGAR NÃO PASSA POR NENHUMA.
//
// Esta ação gravava `active` direto, e até esta branch isso não tinha como doer:
// na `main` toda criação passava por `montarPassos`, e `steps` NUNCA nascia
// vazio. `criarAutomacao` (logo acima) é a primeira coisa do sistema que grava
// uma linha com `steps = '[]'`, de propósito — e o botão "Ativar" da lista de
// automações está a UM CLIQUE dessa linha.
//
// O ESTRAGO, por inteiro: quem mandar a palavra-chave dessa automação cai em
// `executarFluxo(auto, …, 0, …)` (lib/engine.ts). `interpretar` (lib/steps.ts)
// devolve lista vazia — nada a enfileirar, `pararEm: null` —, e o caminho
// termina em `limparCursor`. Ou seja: a pessoa NÃO RECEBE NADA e ainda PERDE O
// LUGAR no fluxo em que estivesse, porque o cursor é do contato, não da
// automação. `findMatch` escolhe a primeira automação ATIVA cujas palavras
// casam, então basta a automação vazia disputar a palavra-chave de uma que
// funciona para ela roubar o disparo e não entregar nada.
//
// NASCER PAUSADA fecha só a porta da criação — este botão é a outra.
//
// É A MESMA `conferirLista` do salvar, e sobre o par que ESTÁ GRAVADO: os blocos
// do banco, as setas do banco, contra o gatilho do banco. Não há metade nova
// aqui — nada está sendo escrito além da coluna `active` —, então o impasse que
// obrigou `salvarAutomacao` a conferir o par FINAL não existe neste caminho.
//
// MAS ELA RECUSA OS DOIS NÍVEIS, e o salvar recusa um só. Essa é a assimetria
// que a Tarefa 5 introduziu, e ela é de PRODUTO:
//
//   "salvar" é dado que o motor NÃO CONSEGUE LER — ele cai, ou anda sem parar.
//     Nenhuma tela pode gravar isso, então trava as duas portas.
//   "ativar" é fluxo que o motor lê perfeitamente e ENTREGA ERRADO: botão sem
//     destino, botão sem texto, bloco que nenhuma seta alcança, bloco de espera
//     que é o fim do caminho (o portão, o pedido de e-mail ou a resposta
//     rápida), link a que se chega sem passar pelo portão, menu com mais botões
//     do que cabe numa mensagem. Todos eles descrevem um desenho pela metade,
//     que é o estado normal de quem está montando — e nenhum deles pode ir ao ar.
//
// ESTE É O MOMENTO EM QUE O DONO DIZ "PODE VALER PARA O PÚBLICO", e é por isso
// que ele é a porta certa para o segundo nível. Avisar na ENTREGA seria avisar
// tarde e para quem não pode consertar — foi o que a Tarefa 2 fez com dois
// destes, registrando-os em Atividade na hora de enviar, e a linha disparava
// também no fim NORMAL de um fluxo de captura, treinando o dono a ignorar
// Atividade.
//
// DESATIVAR NÃO CONFERE NADA, e isso é decisão, não simetria esquecida: desligar
// uma automação quebrada tem que continuar sempre possível. Conferir aqui
// trancaria o dono com uma automação com defeito NO AR, que é o oposto do que
// esta função existe para permitir.
// ---------------------------------------------------------------------------
export async function toggleAutomation(id: string, active: boolean): Promise<Resultado> {
  const accountId = await getSelectedAccountId();
  if (!accountId) return { ok: false, erro: "Nenhuma conta conectada." };

  if (active) {
    // O `ensureSchema` ENTROU AQUI NA TAREFA 5, e ele não é zelo: esta função
    // passou a ler a coluna `ligacoes`, e `ligacoes` é uma das colunas que
    // `ensureSchema` CRIA (`add column if not exists`, lib/db.ts). Num banco que
    // ainda não a tem, o `select` abaixo não devolve nulo — ele estoura
    // `column "ligacoes" does not exist`, e o botão "Ativar" da lista de
    // automações para de funcionar inteiro.
    //
    // MEDIDO NESTE BANCO: a coluna NÃO EXISTE hoje. Um `select ligacoes from
    // automations` contra a `DATABASE_URL` deste projeto devolve o erro 42703. As
    // outras telas a criam de passagem porque chamam `ensureSchema` antes de ler,
    // e `salvarAutomacao` (acima) já fazia isso — esta era a única das duas que
    // lia o par e não chamava.
    //
    // ELE MORA DENTRO DO `if (active)`, e o lugar é o invariante escrito no
    // cabeçalho desta função: "desligar uma automação quebrada tem que continuar
    // sempre possível". Fora do `if`, DESATIVAR passava a depender de ~40
    // comandos de DDL terem sucesso — um `alter table` que falhe por permissão,
    // por lock ou por disco cheio tirava do dono a única saída que ele tem para
    // uma automação com defeito NO AR. Quem precisa da garantia é só o `select
    // ligacoes` logo abaixo, e ele só existe neste ramo.
    //
    // Custa uma vez por instância: a promessa é memoizada em `schemaReady`
    // (lib/db.ts), então a segunda chamada em diante não vai ao banco.
    await ensureSchema();

    // o account_id no where impede ler automação de outra conta
    // `entrega_sem_portao` ENTRA NESTE `select` NA TAREFA 9, e ela é lida do
    // BANCO e não de argumento — ao contrário de `salvarAutomacao`, que grava a
    // decisão. Esta porta não escreve nada da automação: ela julga o que está
    // gravado, e a decisão do dono é parte do que está gravado.
    //
    // O `ensureSchema` LOGO ACIMA É A REDE DELA TAMBÉM. Um `select` de coluna
    // inexistente estoura 42703 e leva o botão "Ativar" da lista de automações
    // inteiro — que é o mesmo estrago que o comentário acima registra para
    // `ligacoes`, e a razão de aquela chamada existir neste ramo.
    const linhas = (await sql().query(
      `select steps, ligacoes, triggers, entrega_sem_portao
         from automations where id = $1 and account_id = $2`,
      [id, accountId]
    )) as {
      steps: unknown;
      ligacoes: unknown;
      triggers: string[] | null;
      entrega_sem_portao: boolean | null;
    }[];
    const a = linhas[0];
    // Zero linhas é automação que não existe OU de outra conta, e as duas dão a
    // mesma resposta pelo mesmo motivo de `salvarAutomacao`: distingui-las
    // contaria a quem tentou que aquele id existe.
    if (!a) return { ok: false, erro: NAO_ENCONTRADA };

    // O GATILHO É O PRIMEIRO DE `triggers`, com `dm` de padrão — a mesma leitura
    // de `app/automacoes/[id]/page.tsx`. Divergir dela faria esta conferência
    // julgar a lista contra um gatilho diferente do que o editor mostra.
    const gatilho = a.triggers?.[0] ?? "dm";
    // OS DOIS NÍVEIS, sem filtrar por `quando`: o de cima já foi recusado no
    // salvar, e chegar aqui com um deles significa que a lista entrou por fora do
    // painel. O de baixo é o que esta porta existe para segurar.
    //
    // A CHAVE DO DONO É O QUARTO ARGUMENTO, e sem ela esta porta e o quadro
    // discordariam: o editor deixaria o dono terminar o fluxo com a caixa
    // marcada, e o "Ativar" da lista de automações — outra tela, depois de ele
    // ter fechado o quadro achando que terminou — recusaria com a frase de um
    // problema que ele já respondeu.
    const erros = conferirLista(
      a.steps,
      gatilho,
      a.ligacoes,
      Boolean(a.entrega_sem_portao)
    ).filter((p) => p.nivel === "erro");
    if (erros.length) return { ok: false, erro: erros[0].mensagem };
  }

  await sql().query(
    `update automations set active = $1, updated_at = now() where id = $2 and account_id = $3`,
    [active, id, accountId]
  );
  revalidatePath("/automacoes");
  return { ok: true };
}

export async function deleteAutomation(id: string): Promise<void> {
  const accountId = await getSelectedAccountId();
  if (!accountId) return;
  await sql().query(`delete from automations where id = $1 and account_id = $2`, [id, accountId]);
  revalidatePath("/automacoes");
}

// Duplica a automação inteira, inclusive os follow-ups. As colunas são copiadas
// por nome (em vez de listadas uma a uma) para a cópia continuar completa
// quando colunas novas forem adicionadas no futuro.
export async function duplicateAutomation(id: string): Promise<void> {
  const accountId = await getSelectedAccountId();
  if (!accountId) return;

  const rows = (await sql().query(
    `select * from automations where id = $1 and account_id = $2`,
    [id, accountId]
  )) as Record<string, unknown>[];
  const original = rows[0];
  if (!original) return;

  // colunas geradas pelo banco não entram na cópia
  const ignorar = new Set(["id", "created_at", "updated_at"]);
  const colunas = Object.keys(original).filter((c) => !ignorar.has(c));
  const valores = colunas.map((c) => {
    if (c === "name") return `${String(original.name ?? "Automação")} (cópia)`;
    // a cópia nasce pausada: evita duas automações disputando a mesma
    // palavra-chave sem o usuário perceber
    if (c === "active") return false;
    return original[c];
  });

  const placeholders = colunas.map((_, i) => `$${i + 1}`).join(", ");
  const novo = (await sql().query(
    `insert into automations (${colunas.map((c) => `"${c}"`).join(", ")})
     values (${placeholders}) returning id`,
    valores
  )) as { id: string }[];

  const novoId = novo[0]?.id;
  if (novoId) {
    await sql().query(
      `insert into followups (automation_id, position, kind, text, button_label, url, delay_minutes)
       select $1, position, kind, text, button_label, url, delay_minutes
       from followups where automation_id = $2`,
      [novoId, id]
    );
  }
  revalidatePath("/automacoes");
}
