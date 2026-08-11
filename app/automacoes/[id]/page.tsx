import { notFound } from "next/navigation";
import { sql, ensureSchema, Automation } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import type { Passo } from "@/lib/steps";
import Quadro from "../editor/quadro";
import type { Configuracao } from "../editor/painel";

export const dynamic = "force-dynamic";

// A LISTA GRAVADA VIRA `Passo[]` AQUI, e a conversão é obrigatória, não
// cerimônia de tipo: `Automation.steps` é `unknown[]` porque jsonb não dá
// garantia nenhuma de forma, e o quadro precisa de `Passo[]`.
//
// NADA É DESCARTADO POR CONTEÚDO, e essa é a decisão desta função. `conferir`
// (lib/steps.ts) é a validação de CONTEÚDO — ela recusa a mensagem sem texto, a
// espera sem minutos, o coraçãozinho sem emoji, e o bloco de tipo desconhecido.
// Filtrar por ela aqui APAGARIA esses blocos da tela, e salvar em seguida os
// apagaria do banco: o dono perde o bloco sem nada dizer que aconteceu.
//
// Deixando-os passar, quem fala sobre eles é `conferirLista` dentro do quadro:
// a borda do nó fica vermelha, o painel mostra a frase, e o salvar fica travado
// até o bloco ser consertado ou apagado à mão. É a mesma função nas duas
// pontas, e é ela que dá ao dono a chance de CONSERTAR em vez de descobrir a
// perda depois.
//
// O TIPO DESCONHECIDO ENTRA NESSA MESMA REGRA, e ele já esteve fora. Esta
// função filtrava por uma lista dos seis tipos desenháveis, porque
// `resumoDoBloco` (editor/modelos.ts) era um `switch` sem ramo padrão e um tipo
// fora dela derrubava o nó e a página. Isso trocava uma queda por um APAGAMENTO
// SILENCIOSO no primeiro salvamento — a perda que o parágrafo acima recusa, com
// outro nome. Hoje `resumoDoBloco` tem ramo padrão, o bloco aparece como
// "BLOCO DESCONHECIDO", `conferirLista` acende o erro e o salvar trava.
//
// O QUE SOBRA DE FILTRO é o item que não tem forma de OBJETO — `null`, número,
// texto solto. Ele não é o mesmo caso: sem objeto não há `id` nem `pos`, ou
// seja não há nó a desenhar nem identidade para o React Flow, e `p.pos` no
// quadro estouraria antes de qualquer conferência. `interpretar` (lib/steps.ts)
// já o ignora, então ele não envia nada hoje tampouco. É a única perda calada
// que continua aqui, e ela está dita.
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
  // trabalha com um só, como o formulário também fazia. É o mesmo gatilho que
  // `salvarAutomacao` (../actions.ts) grava de volta, num elemento só.
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

  // A PÁGINA NÃO TEM MAIS CABEÇALHO, e ela renderiza SÓ o quadro.
  //
  // A migalha, o `<h1>` e o subtítulo comiam 256px de altura — que era
  // exatamente o `h-[calc(100vh-16rem)]` do quadro —, e a casca do aplicativo
  // ainda limitava tudo a 1024px de largura. Numa tela cujo produto é um espaço
  // de trabalho, esse cabeçalho custava mais do que dizia: o nome da automação
  // reaparece na barra do próprio quadro, e as instruções que estavam no
  // subtítulo são o que a paleta e o painel já mostram no lugar em que se
  // precisa delas.
  //
  // Quem tira a casca é `app/app-shell.tsx`, que reconhece esta rota pela forma
  // do id. O `<main>` da página passa a ser o do quadro.
  //
  // O NOME NÃO VIAJA COMO PROP SEPARADA: ele já vai em `configuracaoInicial.nome`
  // e o painel do gatilho o EDITA. Uma segunda cópia vinda daqui ficaria
  // congelada em `a.name` e a barra mostraria o nome velho enquanto o dono
  // digita o novo. O porquê inteiro está no comentário da barra, em
  // `../editor/quadro.tsx`.
  // A CONTA vai junto porque a prévia desenha o celular de quem RECEBE, e o
  // cabeçalho daquele celular é esta conta. Ela já foi buscada acima para saber
  // de quem é a automação, então isto reaproveita a mesma leitura.
  //
  // O comentário fica AQUI e não entre os atributos: comentário `//` dentro da
  // lista de atributos de um elemento JSX passa no `tsc` e no `next build` e
  // engole a prop seguinte no compilador do modo de desenvolvimento — a página
  // quebrou em produção local com `conta` chegando `undefined`, e nada acusou.
  const contaDaPrevia = {
    usuario: selected.username,
    nome: selected.name,
    foto: selected.profile_picture_url,
  };

  return (
    <Quadro
      automationId={a.id}
      passosIniciais={passosDoBanco(a.steps)}
      configuracaoInicial={configuracaoInicial}
      conta={contaDaPrevia}
    />
  );
}
