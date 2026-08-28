"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateConfig, listAccounts, getConfig, getAccount } from "@/lib/db";
import { subscribeToWebhooks, configureAppWebhook, CAMPOS_DE_WEBHOOK } from "@/lib/ig";
import { canonicalAppUrl, isEphemeralUrl } from "@/lib/app-url";
import {
  MAXIMO_DE_PERGUNTAS,
  perguntasQueNaoFicaram,
  sincronizarPerguntas,
} from "@/lib/perguntas-de-abertura";
import { perguntasDoFormulario } from "./portas";

// Reassina `CAMPOS_DE_WEBHOOK` (lib/ig.ts) em todas as contas conectadas. A
// assinatura já acontece sozinha no OAuth, mas se falhar naquele momento nada
// chega e o painel fica mudo — este botão conserta sem precisar reconectar tudo.
//
// E ELE É TAMBÉM O ÚNICO CAMINHO PARA CAMPO NOVO. A inscrição por conta é
// gravada uma vez, no OAuth: acrescentar um campo em `CAMPOS_DE_WEBHOOK` não
// mexe em quem já está conectado. Sem este botão, a única saída seria
// desconectar e reconectar a conta do dono — o que apagaria a ligação viva com
// a Meta por causa de uma linha de configuração.
export async function reassinarWebhooks(): Promise<void> {
  const accounts = await listAccounts();
  let ok = 0;
  const falhas: string[] = [];
  for (const a of accounts) {
    try {
      await subscribeToWebhooks(a.ig_user_id, a.access_token);
      ok++;
    } catch (err) {
      falhas.push(
        `@${a.username ?? a.ig_user_id}: ${err instanceof Error ? err.message.slice(0, 80) : "erro"}`
      );
    }
  }
  revalidatePath("/setup");
  if (falhas.length) {
    redirect(`/setup?erro=${encodeURIComponent(falhas.join(" | "))}`);
  }
  redirect(`/setup?salvo=${encodeURIComponent(`Webhooks reassinados em ${ok} conta(s).`)}`);
}

// ============================================================
// Autoteste do webhook: faz exatamente o que a Meta faz (GET com hub.mode,
// hub.verify_token e hub.challenge) contra a própria URL pública e reporta o
// resultado REAL. É isto que transforma o erro genérico da Meta
// ("não foi possível validar a URL de callback ou o token de verificação")
// num diagnóstico específico e acionável.
// ============================================================
export async function testarWebhook(): Promise<void> {
  const config = await getConfig();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const appUrl = canonicalAppUrl(config.app_url, host ? `${proto}://${host}` : null);

  if (!appUrl) {
    redirect(`/setup?erro=${encodeURIComponent("Não consegui detectar a URL pública do app.")}`);
  }

  const token = config.webhook_verify_token ?? process.env.WEBHOOK_VERIFY_TOKEN ?? "";
  if (!token) {
    redirect(
      `/setup?erro=${encodeURIComponent("Este install ainda não tem token de verificação.")}`
    );
  }

  const desafio = `teste${Date.now()}`;
  const url =
    `${appUrl}/api/webhook?hub.mode=subscribe` +
    `&hub.verify_token=${encodeURIComponent(token)}` +
    `&hub.challenge=${desafio}`;

  let status = 0;
  let corpo = "";
  try {
    const res = await fetch(url, { redirect: "manual", cache: "no-store" });
    status = res.status;
    corpo = (await res.text()).slice(0, 400);
  } catch (err) {
    redirect(
      `/setup?erro=${encodeURIComponent(
        `Não consegui acessar ${appUrl}/api/webhook (${
          err instanceof Error ? err.message.slice(0, 120) : "erro de rede"
        }). A Meta também não vai conseguir.`
      )}`
    );
  }

  if (status === 200 && corpo.trim() === desafio) {
    revalidatePath("/setup");
    redirect(
      `/setup?salvo=${encodeURIComponent(
        `Webhook validado ✓ — ${appUrl}/api/webhook respondeu corretamente. Pode salvar na Meta com este token.`
      )}`
    );
  }

  // Traduz o que deu errado em algo que o usuário consegue resolver.
  const pareceLoginDaVercel =
    /vercel|authentication|sso|login/i.test(corpo) && (status === 401 || status === 403);
  let diagnostico: string;
  if (pareceLoginDaVercel || (status === 401 && isEphemeralUrl(appUrl))) {
    diagnostico =
      "a Vercel está exigindo login para acessar esta URL (Deployment Protection). " +
      "Desligue em Vercel → Settings → Deployment Protection, ou use o domínio de produção.";
  } else if (isEphemeralUrl(appUrl)) {
    diagnostico =
      "esta é uma URL de deployment temporária da Vercel, que muda a cada deploy e costuma " +
      "exigir login. Use o domínio de produção do projeto (ou defina a variável APP_URL).";
  } else if (status === 503) {
    diagnostico = "o banco de dados não está acessível. Conecte o Neon ao projeto e refaça o deploy.";
  } else if (status === 404) {
    diagnostico = "a rota /api/webhook não existe nesta URL — confira se o deploy é deste app.";
  } else if (status === 403) {
    diagnostico = `o app recusou a verificação: ${corpo.slice(0, 200)}`;
  } else {
    diagnostico = `resposta inesperada (HTTP ${status}): ${corpo.slice(0, 200)}`;
  }

  redirect(`/setup?erro=${encodeURIComponent(`Teste do webhook falhou — ${diagnostico}`)}`);
}

// Configura o webhook do app na Meta automaticamente (callback + verify token +
// os campos de `CAMPOS_DE_WEBHOOK`, lib/ig.ts), no lugar de o usuário colar isso
// à mão no painel. Esta é a assinatura do APP, e ela é OUTRA que não a de cada
// conta: as duas precisam listar o campo para o evento chegar.
// Usa o App ID + Chave secreta PRINCIPAIS (Configurações → Básico) — que são
// diferentes das credenciais do login do Instagram. Se vierem no formulário,
// são salvas; senão, usa as já salvas (com fallback nas do login).
export async function configurarWebhookAuto(formData: FormData): Promise<void> {
  const config = await getConfig();

  const metaAppId = String(formData.get("meta_app_id") ?? "").trim();
  const metaAppSecret = String(formData.get("meta_app_secret") ?? "").trim();
  if (metaAppId || metaAppSecret) {
    await updateConfig({
      ...(metaAppId ? { meta_app_id: metaAppId } : {}),
      ...(metaAppSecret ? { meta_app_secret: metaAppSecret } : {}),
    });
  }

  const appId = metaAppId || config.meta_app_id || config.instagram_app_id;
  const appSecret = metaAppSecret || config.meta_app_secret || config.instagram_app_secret;
  if (!appId || !appSecret) {
    redirect(
      `/setup?erro=${encodeURIComponent(
        "Informe o App ID e a Chave secreta do app (Configurações → Básico) para a configuração automática."
      )}`
    );
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const appUrl = config.app_url ?? (host ? `${proto}://${host}` : null);
  if (!appUrl) {
    redirect(`/setup?erro=${encodeURIComponent("Não consegui detectar a URL pública do app.")}`);
  }

  try {
    await configureAppWebhook({
      appId,
      appSecret,
      callbackUrl: `${appUrl}/api/webhook`,
      verifyToken: config.webhook_verify_token ?? "",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 160) : "erro";
    redirect(
      `/setup?erro=${encodeURIComponent(
        `Não deu para configurar o webhook automaticamente (${msg}). Você ainda pode configurar manualmente no passo 3b.`
      )}`
    );
  }
  revalidatePath("/setup");
  redirect(
    `/setup?salvo=${encodeURIComponent(
      `Webhook configurado automaticamente ✓ (callback + campos ${CAMPOS_DE_WEBHOOK}).`
    )}`
  );
}

export async function saveMetaCredentials(formData: FormData): Promise<void> {
  const appId = String(formData.get("instagram_app_id") ?? "").trim();
  const appSecret = String(formData.get("instagram_app_secret") ?? "").trim();
  if (!appId || !appSecret) {
    redirect(`/setup?erro=${encodeURIComponent("Preencha o App ID e a chave secreta.")}`);
  }

  // Captura a URL pública do app. Só grava se for um endereço ESTÁVEL: gravar
  // uma URL de deployment da Vercel quebra o webhook e o OAuth no deploy
  // seguinte, porque esse endereço muda toda vez.
  const h = await headers(); // Next 16: headers() é assíncrono
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origem = host ? `${proto}://${host}` : null;
  const appUrl = canonicalAppUrl(null, origem);

  await updateConfig({
    instagram_app_id: appId,
    instagram_app_secret: appSecret,
    ...(appUrl && !isEphemeralUrl(appUrl) ? { app_url: appUrl } : {}),
  });
  revalidatePath("/setup");
  redirect("/setup?salvo=1");
}

// ============================================================
// AS QUATRO PERGUNTAS DE ABERTURA DE UMA CONTA (`portas-de-entrada.tsx`).
//
// Ela grava na META, e não no banco: as perguntas vivem no perfil da conta lá,
// e é de lá que a tela as lê de volta. Não há linha em tabela nenhuma para
// manter em dia — o que evita o pior desfecho possível desta tela, que seria o
// painel e a Meta discordarem sobre o que está no ar.
//
// TUDO QUE ELA DECIDE ESTÁ FORA DAQUI, e é de propósito: `perguntasDoFormulario`
// (./portas.ts) traduz o formulário em lista, `conferirPerguntas` aplica o
// limite de quatro e `acaoDaEscrita` escolhe entre POST e DELETE — as três com
// teste puro. Aqui só se lê `FormData`, se chama, e se conta o que aconteceu.
// ============================================================
export async function salvarPerguntasDeAbertura(formData: FormData): Promise<void> {
  const igUserId = String(formData.get("conta") ?? "").trim();
  const conta = await getAccount(igUserId);
  // A CONTA VEM DO FORMULÁRIO, então ela é conferida contra as conectadas. Sem
  // isto, um id qualquer viraria uma chamada à Meta com o token de outra conta.
  if (!conta) {
    redirect(`/setup?erro=${encodeURIComponent("Esta conta não está conectada neste painel.")}`);
  }

  // O teto existe para o laço não depender de um número que veio do navegador.
  // Quatro é o limite da Meta; o dobro cobre a conta com perguntas em vários
  // idiomas, que é o caso em que a tela mostra mais de quatro posições.
  const posicoes = Math.min(Math.max(0, Number(formData.get("posicoes") ?? 0)), 2 * MAXIMO_DE_PERGUNTAS);
  const linhas = [];
  for (let i = 1; i <= posicoes; i++) {
    linhas.push({
      texto: String(formData.get(`texto-${i}`) ?? ""),
      automacaoId: String(formData.get(`automacao-${i}`) ?? ""),
      payload: String(formData.get(`payload-${i}`) ?? ""),
    });
  }

  const { perguntas, motivo } = perguntasDoFormulario(linhas);
  if (!perguntas) {
    redirect(`/setup?erro=${encodeURIComponent(motivo ?? "Não deu para ler o formulário.")}`);
  }

  const r = await sincronizarPerguntas(conta.ig_user_id, conta.access_token, perguntas);
  if (!r.efeito) {
    redirect(`/setup?erro=${encodeURIComponent(r.motivo ?? "Não deu para gravar as perguntas.")}`);
  }
  const efeito = r.efeito;
  if (efeito.status !== 200) {
    // O CORPO DA META VAI JUNTO, cortado. O erro mais provável aqui é de
    // formato, e o subcode dele é a única coisa que diz qual — sem ele, o dono
    // lê "não deu certo" e não tem por onde seguir. O token não aparece em
    // resposta de erro da Meta: o que volta é `message`, `type`, `code` e
    // `fbtrace_id`.
    redirect(
      `/setup?erro=${encodeURIComponent(
        `A Meta recusou as perguntas de @${conta.username ?? conta.ig_user_id} (HTTP ${efeito.status}): ${efeito.corpo.slice(0, 300)}`
      )}`
    );
  }

  // A LEITURA DE VOLTA É A PROVA, e não o 200 do POST.
  //
  // ISTO NÃO É ZELO ABSTRATO: foi assim que o caso do dois-pontos apareceu. A
  // Meta respondeu `{"result":"success"}` com HTTP 200 e guardou a pergunta SEM
  // o identificador — a tela teria dito "salvo ✓" sobre uma pergunta que
  // aparece para toda pessoa que abre a conversa e não dispara nada.
  const sumiram = perguntasQueNaoFicaram(perguntas, efeito.leitura.perguntas);
  if (sumiram.length) {
    redirect(
      `/setup?erro=${encodeURIComponent(
        `A Meta aceitou a chamada (HTTP 200) mas não guardou como foi mandado: ${sumiram
          .map((p) => `“${p.question}”`)
          .join(", ")}. Confira as perguntas desta conta antes de contar com elas.`
      )}`
    );
  }

  // O número que aparece na confirmação é o que a META devolveu, não o que
  // mandamos.
  const noAr = efeito.leitura.perguntas.length;
  revalidatePath("/setup");
  redirect(
    `/setup?salvo=${encodeURIComponent(
      noAr === 0
        ? `@${conta.username ?? conta.ig_user_id} ficou sem pergunta de abertura nenhuma ✓`
        : `@${conta.username ?? conta.ig_user_id} está com ${noAr} pergunta(s) de abertura no ar ✓`
    )}`
  );
}
