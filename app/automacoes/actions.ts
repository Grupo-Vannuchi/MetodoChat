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

// O que os dois salvares devolvem. Nem um nem outro redireciona: o quadro é uma
// tela em que se salva várias vezes seguidas, e mandar a pessoa embora a cada
// gravação era o comportamento do formulário, que tinha um botão só no fim.
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

// ---------------------------------------------------------------------------
// SALVAR SÃO DOIS, e a separação é a decisão mais importante deste arquivo.
//
// `montarPassos` e `saveAutomation` MORRERAM AQUI, junto com `form.tsx`. Elas
// eram uma escrita só: liam as vinte e oito colunas do formulário, REGRAVAVAM
// `steps` a partir delas e redirecionavam. Chamar aquilo com o quadro montado
// apagaria a lista de blocos — a lista virava o que as colunas antigas
// descreviam, numa ordem fixa escrita em código.
//
// No lugar delas, duas gravações com escopos que não se pisam:
//
//   `salvarPassos` .......... SÓ a coluna `steps`.
//   `salvarConfiguracao` .... SÓ as colunas da automação. NUNCA `steps`.
//
// Escrita parcial deixa de poder misturar as duas coisas: o pior caso é uma
// delas não acontecer, e não metade de cada uma no banco.
// ---------------------------------------------------------------------------

// Grava a lista montada no quadro. NÃO escreve nome, ativo, gatilho,
// palavras-chave, correspondência nem mídia — isso é `salvarConfiguracao`.
//
// A CONFERÊNCIA RODA AQUI DE NOVO, e não é redundância: o cliente já conferiu
// para desabilitar o botão, mas o cliente é o navegador da pessoa e nada que
// vem de lá é confiável. É a MESMA função (`conferirLista`, lib/steps.ts) nos
// dois lados — escrever a regra duas vezes é como as duas versões passam a
// discordar.
//
// O GATILHO VEM DO BANCO, e não do argumento, pelo mesmo motivo: ele decide o
// que `conferirLista` recusa (resposta pública fora do comentário,
// coraçãozinho fora do story), e aceitá-lo do navegador seria deixar a própria
// conferência ser escolhida por quem está sendo conferido. É por isso que o
// quadro salva a CONFIGURAÇÃO PRIMEIRO: assim o gatilho que esta função lê já é
// o que a pessoa acabou de escolher na tela.
export async function salvarPassos(automationId: string, passos: unknown): Promise<Resultado> {
  await ensureSchema();
  const accountId = await getSelectedAccountId();
  if (!accountId) return { ok: false, erro: "Nenhuma conta conectada." };

  const linhas = (await sql().query(
    `select triggers from automations where id = $1 and account_id = $2`,
    [automationId, accountId]
  )) as { triggers: string[] }[];
  if (!linhas[0]) return { ok: false, erro: "Automação não encontrada." };

  const problemas = conferirLista(passos, linhas[0].triggers[0] ?? "dm");
  const erros = problemas.filter((p) => p.nivel === "erro");
  if (erros.length) return { ok: false, erro: erros[0].mensagem };

  // o account_id no where impede gravar em automação de outra conta
  await sql().query(
    `update automations set steps = $1, updated_at = now()
     where id = $2 and account_id = $3`,
    [passos, automationId, accountId]
  );
  revalidatePath("/automacoes");
  return { ok: true };
}

// O post ou story escolhido no painel do gatilho, normalizado. Devolve null para
// qualquer coisa que não tenha a forma esperada — é dado do navegador.
function midiaEscolhida(v: unknown): { id: string; thumb: string; caption: string } | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Record<string, unknown>;
  const id = String(m.id ?? "");
  if (!id) return null;
  return { id, thumb: String(m.thumb ?? ""), caption: String(m.caption ?? "") };
}

// Grava o que a automação é FORA da lista de blocos: nome, ativo, gatilho,
// palavras-chave, correspondência, post e story.
//
// NÃO ESCREVE `steps`, e é essa ausência que faz esta função existir em vez de
// `saveAutomation`. Nem escreve as vinte e oito colunas do formulário antigo
// (`welcome_text`, `link_url`, `require_follow`, …): elas viraram blocos, o
// motor não as lê mais, e regravá-las aqui seria manter viva uma segunda
// descrição do mesmo fluxo — a que já divergiu uma vez.
//
// A configuração chega como `unknown` de propósito: ela vem do estado de um
// componente de cliente, e a assinatura tipada daria a impressão de garantia
// que o POST direto no Server Action não tem.
export async function salvarConfiguracao(
  automationId: string,
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

  // o account_id no where impede gravar em automação de outra conta
  const linhas = (await sql().query(
    `update automations set
       name = $1, active = $2, triggers = $3, keywords = $4, match_type = $5,
       media_id = $6, media_thumbnail_url = $7, media_caption = $8,
       story_id = $9, story_thumbnail_url = $10, updated_at = now()
     where id = $11 and account_id = $12
     returning id`,
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
  )) as { id: string }[];
  if (!linhas[0]) return { ok: false, erro: "Automação não encontrada." };

  revalidatePath("/automacoes");
  return { ok: true };
}

// Cria a automação com o mínimo e manda para o quadro.
//
// POR QUE CRIAR ANTES DE EDITAR: `salvarPassos` precisa de um id, e automação
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

export async function toggleAutomation(id: string, active: boolean): Promise<void> {
  const accountId = await getSelectedAccountId();
  if (!accountId) return;
  await sql().query(
    `update automations set active = $1, updated_at = now() where id = $2 and account_id = $3`,
    [active, id, accountId]
  );
  revalidatePath("/automacoes");
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
