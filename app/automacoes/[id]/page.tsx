import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, ensureSchema, Automation } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import type { Passo } from "@/lib/steps";
import Quadro from "../editor/quadro";
import type { Configuracao } from "../editor/painel";
import { pageTitle, pageSubtitle, muted } from "../../ui";

export const dynamic = "force-dynamic";

// Os seis tipos que o quadro sabe DESENHAR. É `resumoDoBloco`
// (editor/modelos.ts) que fixa esta lista: ele é um `switch` sobre `p.tipo` sem
// ramo padrão, e um tipo fora dela o faz devolver `undefined` — a
// desestruturação de `{ titulo, corpo }` derruba o nó, e com ele a página.
const TIPOS_DESENHAVEIS = [
  "dm",
  "esperar",
  "pedir_follow",
  "pedir_email",
  "resposta_publica",
  "reagir_story",
];

// A LISTA GRAVADA VIRA `Passo[]` AQUI, e a conversão é obrigatória, não
// cerimônia de tipo: `Automation.steps` é `unknown[]` porque jsonb não dá
// garantia nenhuma de forma, e o quadro precisa de `Passo[]`.
//
// O CRITÉRIO É "DÁ PARA DESENHAR", E NÃO "É VÁLIDO", e a diferença é a decisão
// desta função. `conferir` (lib/steps.ts) é a validação de CONTEÚDO — ela
// recusa a mensagem sem texto, a espera sem minutos, o coraçãozinho sem emoji.
// Filtrar por ela aqui APAGARIA esses blocos da tela, e salvar em seguida os
// apagaria do banco: o dono perde o bloco por tê-lo deixado incompleto, sem
// nada dizer que aconteceu.
//
// Deixando-os passar, quem fala sobre eles é `conferirLista` dentro do quadro:
// a borda do nó fica vermelha, o painel mostra a frase, e o salvar fica travado
// até o campo ser preenchido. É a mesma função nas duas pontas, e é ela que dá
// ao dono a chance de CONSERTAR em vez de descobrir a perda depois.
//
// O que de fato não passa é o bloco que não tem como ser desenhado — sem forma
// de objeto, ou com um `tipo` que a tela não conhece. Não há como mostrá-lo, e
// `interpretar` já o ignora, então ele não envia nada hoje tampouco.
//
// `pos` É CONFERIDA À PARTE porque ela vem do banco como jsonb qualquer: o
// quadro faz `p.pos ?? { x: 0, y: 0 }` e entrega isso ao React Flow, e um `pos`
// que não seja um par de números vira posição inválida no nó. Descartada,
// `arranjoAutomatico` (editor/modelos.ts) dá uma posição nova ao bloco.
function passosDoBanco(steps: unknown): Passo[] {
  if (!Array.isArray(steps)) return [];
  const lista: Passo[] = [];
  for (const item of steps) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.tipo !== "string" || !TIPOS_DESENHAVEIS.includes(o.tipo)) continue;

    const p = o.pos as { x?: unknown; y?: unknown } | null | undefined;
    const posBoa =
      !!p && typeof p === "object" && typeof p.x === "number" && typeof p.y === "number";
    lista.push((posBoa ? o : { ...o, pos: undefined }) as Passo);
  }
  return lista;
}

export default async function EditarAutomacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // Next 16: params é assíncrono
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  await ensureSchema();
  const selected = await getSelectedAccount();
  if (!selected) notFound();

  // só abre automação da conta selecionada
  const rows = (await sql().query(
    `select * from automations where id = $1 and account_id = $2`,
    [id, selected.ig_user_id]
  )) as Automation[];
  const a = rows[0];
  if (!a) notFound();

  // O GATILHO É O PRIMEIRO DE `triggers`, e o padrão é `dm`. A coluna é um
  // array por herança — automação antiga chegou a ter vários —, mas o editor
  // trabalha com um só, como o formulário já fazia.
  const configuracaoInicial: Configuracao = {
    nome: a.name,
    ativo: a.active,
    gatilho: a.triggers[0] ?? "dm",
    palavras: a.keywords,
    correspondencia: a.match_type,
    post: a.media_id
      ? { id: a.media_id, thumb: a.media_thumbnail_url ?? "", caption: a.media_caption ?? "" }
      : null,
    story: a.story_id
      ? { id: a.story_id, thumb: a.story_thumbnail_url ?? "", caption: "" }
      : null,
  };

  return (
    <div className="space-y-6">
      <header>
        <nav className={`mb-2 text-xs ${muted}`}>
          <Link href="/automacoes" className="transition-colors hover:text-indigo-600">
            Automações
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-zinc-700 dark:text-zinc-300">{a.name}</span>
        </nav>
        <h1 className={pageTitle}>{a.name}</h1>
        <p className={pageSubtitle}>
          Arraste os blocos da paleta para montar o fluxo. Clique num bloco para editá-lo, e no
          gatilho para mudar o nome, as palavras-chave e o que dispara a automação.
        </p>
      </header>
      <Quadro
        automationId={a.id}
        passosIniciais={passosDoBanco(a.steps)}
        configuracaoInicial={configuracaoInicial}
      />
    </div>
  );
}
