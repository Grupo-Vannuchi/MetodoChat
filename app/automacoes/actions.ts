"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql, ensureSchema } from "@/lib/db";
import { getSelectedAccountId } from "@/lib/account";
import { conferirLista } from "@/lib/steps";

function splitList(raw: string, sep: RegExp): string[] {
  return raw
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

// O que o salvar devolve. Ele NÃO redireciona: o quadro é uma tela em que se
// salva várias vezes seguidas, e mandar a pessoa embora a cada gravação era o
// comportamento do formulário, que tinha um botão só no fim.
type Resultado = { ok: true } | { ok: false; erro: string };

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
// A configuração e a lista chegam como `unknown` de propósito: as duas vêm do
// estado de um componente de cliente, e assinatura tipada daria a impressão de
// uma garantia que o POST direto no Server Action não tem.
//
// O QUE ESTA FUNÇÃO NÃO ESCREVE são as vinte e oito colunas do formulário antigo
// (`welcome_text`, `link_url`, `require_follow`, …): elas viraram blocos, o
// motor não as lê mais, e regravá-las aqui seria manter viva uma segunda
// descrição do mesmo fluxo — a que já divergiu uma vez.
// ---------------------------------------------------------------------------
export async function salvarAutomacao(
  automationId: string,
  passos: unknown,
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

  // A CONFERÊNCIA DO PAR FINAL, UMA VEZ SÓ: os blocos que vão ser gravados
  // contra o gatilho que vai ser gravado. Nada do que está no banco entra aqui —
  // ele está prestes a deixar de valer.
  const erros = conferirLista(passos, gatilho).filter((p) => p.nivel === "erro");
  if (erros.length) return { ok: false, erro: erros[0].mensagem };

  try {
    await sql().begin(async (tx) => {
      // ESCOPO 1 — SÓ `steps`. O `returning id` faz o serviço da consulta de
      // existência que havia antes: zero linhas significa automação que não
      // existe OU que é de outra conta, e as duas dão a mesma resposta de
      // propósito — distingui-las contaria a quem tentou que aquele id existe.
      //
      // o account_id no where impede gravar em automação de outra conta
      const linhas = (await tx.query(
        `update automations set steps = $1, updated_at = now()
         where id = $2 and account_id = $3
         returning id`,
        [passos, automationId, accountId]
      )) as { id: string }[];
      // Lançar aqui é o que DESFAZ a transação. Devolver não desfaria: o `update`
      // seguinte é que ficaria de fora, e o primeiro valeria sozinho.
      if (!linhas[0]) throw new Error(NAO_ENCONTRADA);

      // ESCOPO 2 — SÓ as colunas da automação, NUNCA `steps`.
      //
      // o account_id no where impede gravar em automação de outra conta
      await tx.query(
        `update automations set
           name = $1, active = $2, triggers = $3, keywords = $4, match_type = $5,
           media_id = $6, media_thumbnail_url = $7, media_caption = $8,
           story_id = $9, story_thumbnail_url = $10, updated_at = now()
         where id = $11 and account_id = $12`,
        [
          nome,
          ativo,
          [gatilho],
          palavras,
          correspondencia,
          post?.id ?? null,
          post?.thumb ?? null,
          post?.caption ?? null,
          story?.id ?? null,
          story?.thumb ?? null,
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
// do banco contra o gatilho do banco. Não há metade nova aqui — nada está sendo
// escrito além da coluna `active` —, então o impasse que obrigou `salvarAutomacao`
// a conferir o par FINAL não existe neste caminho.
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
    // o account_id no where impede ler automação de outra conta
    const linhas = (await sql().query(
      `select steps, triggers from automations where id = $1 and account_id = $2`,
      [id, accountId]
    )) as { steps: unknown; triggers: string[] | null }[];
    const a = linhas[0];
    // Zero linhas é automação que não existe OU de outra conta, e as duas dão a
    // mesma resposta pelo mesmo motivo de `salvarAutomacao`: distingui-las
    // contaria a quem tentou que aquele id existe.
    if (!a) return { ok: false, erro: NAO_ENCONTRADA };

    // O GATILHO É O PRIMEIRO DE `triggers`, com `dm` de padrão — a mesma leitura
    // de `app/automacoes/[id]/page.tsx`. Divergir dela faria esta conferência
    // julgar a lista contra um gatilho diferente do que o editor mostra.
    const gatilho = a.triggers?.[0] ?? "dm";
    const erros = conferirLista(a.steps, gatilho).filter((p) => p.nivel === "erro");
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
