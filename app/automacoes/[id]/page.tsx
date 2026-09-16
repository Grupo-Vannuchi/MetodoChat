import { notFound } from "next/navigation";
import { sql, Automation } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { ligacoesValidas, type Passo } from "@/lib/steps";
import {
  resolvePosts,
  TETO_DA_CAPA_NA_TELA_MS,
  type PostRef,
} from "@/lib/media-lookup";
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
//
// AS SETAS NÃO GANHAM FUNÇÃO PRÓPRIA AQUI: quem as peneira é `ligacoesValidas`
// (lib/steps.ts), a mesma função que `salvarAutomacao` (../actions.ts) usa na
// volta. A regra de descarte delas é a OPOSTA da desta função, e o porquê está
// escrito lá: um bloco quebrado tem nó, painel e conserto, então é mantido; uma
// ligação quebrada não tem nenhum dos três, e `ligacoesDe` já a ignora.
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
  const selected = await getSelectedAccount();
  if (!selected) notFound();

  // só abre automação da conta selecionada
  const rows = (await sql().query(
    `select * from automations where id = $1 and account_id = $2`,
    [id, selected.ig_user_id]
  )) as Automation[];
  const a = rows[0];
  if (!a) notFound();

  // A CAPA DO POST NÃO VEM MAIS DO BANCO — a mesma regra de
  // `app/automacoes/page.tsx` (a lista) e de `app/page.tsx` (o Início), e o
  // motivo é o mesmo dos dois: `media_thumbnail_url` é uma URL assinada do CDN
  // do Instagram que expira em ~2 semanas, e uma coluna que guarda algo com
  // prazo de validade é uma coluna que mente com o tempo — parecer preenchida
  // é o que esconde o problema. `lib/media-lookup.ts` já resolve isso na hora
  // de exibir; o editor passa a seguir a mesma regra em vez de reler a coluna
  // que apodrece.
  //
  // E ISTO FECHA UM SEGUNDO DEFEITO DE GRAÇA: uma automação criada a partir do
  // Início (`/automacoes/nova?post=…`) grava só `media_id`
  // (`criarAutomacao`, ../actions.ts) — `media_caption` e
  // `media_thumbnail_url` nascem NULOS. Sem esta busca, o editor abria com o
  // id numérico cru no lugar do nome (`MediaPicker`,
  // `selected.caption || selected.id`, ../media-picker.tsx), porque lia
  // colunas vazias. Buscando na hora, ela mostra a legenda como qualquer
  // outra automação.
  //
  // TETO DE TEMPO NO CALL SITE — HOJE ELE É REDE DE FORA, E NÃO O TETO.
  //
  // Quem decide o prazo é `TETO_DA_RESOLUCAO_MS` = 2000 ms, DENTRO de
  // `resolvePosts` (lib/media-lookup.ts): orçamento TOTAL das duas etapas.
  // Este parágrafo já disse "até ~16s" — duas etapas encadeadas, cada uma até
  // o `TETO_DA_LEITURA_MS` de 8 s do `graphFetch` (lib/ig.ts) — e a frase
  // morreu no dia em que o prazo entrou na função. O pior caso de espera aqui
  // é `TETO_DA_RESOLUCAO_MS`, e é contra ELE que o `TETO_DA_CAPA_NA_TELA_MS`
  // abaixo se dimensiona — por CONSTRUÇÃO, porque um é derivado do outro mais
  // uma folga (lib/media-lookup.ts). Ficando sempre acima, esta corrida quase
  // nunca vence.
  //
  // E `resolvePosts` NÃO devolve mais mapa vazio quando algo dá errado:
  // devolve o mapa PARCIAL, com o que já tinha chegado. Esta tela pede UM id,
  // então "parcial" aqui só pode ser veio ou não veio — a entrega parcial
  // rende para as telas que pedem lista. O que muda para o editor é o número,
  // e quem for mexer no teto abaixo precisa do número certo.
  //
  // A corrida e o `try/catch` FICAM como segunda rede, para o que o teto de
  // dentro não cobre (a função travar antes de marcar o próprio início, por
  // exemplo). Sem a capa, o editor abre igual: `media_caption` guardado é o
  // recuo.
  let doPost: PostRef | undefined;
  if (a.media_id) {
    // `idDoTimer` cancela o `setTimeout` quando `resolvePosts` ganha a
    // corrida primeiro — o caso comum. Sem o `clearTimeout`, um timer do
    // tamanho do teto sobrevive a cada requisição que abre esta página,
    // pendurado à toa.
    let idDoTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const capas = await Promise.race([
        resolvePosts(selected.ig_user_id, selected.access_token, [a.media_id]),
        new Promise<Map<string, PostRef>>((resolve) => {
          idDoTimer = setTimeout(() => resolve(new Map()), TETO_DA_CAPA_NA_TELA_MS);
        }),
      ]);
      doPost = capas.get(a.media_id);
    } catch (e) {
      console.error("editor da automação: a capa do post falhou", e);
    } finally {
      clearTimeout(idDoTimer);
    }
  }

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
    // A LEGENDA GANHA UM RECUO: o que a Meta devolveu agora, o guardado
    // depois. `media_caption` não expira, e é o nome que a pessoa reconhece
    // quando a busca falha e a capa não chega.
    //
    // O CORTE EM 120 TEM UM DONO SÓ: é o mesmo corte que `media-picker.tsx`
    // já aplica na legenda que vem da grade de posts (`.slice(0, 120)`, linha
    // 92). Sem ele aqui, `doPost?.caption` (a legenda INTEIRA que a Meta
    // devolve — até 2200 caracteres) ia direto para `salvarAutomacao`, que a
    // grava sem cortar: a automação nascia com um texto vinte vezes maior do
    // que o seletor de post jamais deixaria escolher.
    post: a.media_id
      ? {
          id: a.media_id,
          thumb: doPost?.thumb ?? "",
          caption: (doPost?.caption ?? a.media_caption ?? "").slice(0, 120),
        }
      : null,
    // A CAPA DO STORY NÃO É RESOLVIDA NA HORA — story está fora do escopo
    // desta branch (zero automações usam story, medido). Mas `a.story_thumbnail_url`
    // é a MESMA classe de URL assinada que apodrece em ~2 semanas, e
    // `previa.tsx` a transforma em `<img src={story.thumb}>` sem conferir
    // validade. Sem busca fresca para substituí-la, o único jeito honesto de
    // não entregar imagem quebrada é não entregar capa nenhuma: `thumb: ""`
    // cai no ícone de câmera do lugar do `<img>`.
    story: a.story_id ? { id: a.story_id, thumb: "", caption: "" } : null,
    // O `Boolean` NÃO É ENFEITE, E EM 26/08 ELE GANHOU RAZÃO DE EXECUÇÃO AQUI
    // TAMBÉM. Até então, um `await ensureSchema()` rodava algumas linhas acima,
    // ANTES do `select *`, carregando a mesma DDL `if not exists` de
    // `migrations/002-entrega-sem-portao.sql` — a coluna existia por construção e
    // o cenário "a coluna não veio" não era alcançável daqui. **Essa rede foi
    // apagada**: quem garante a coluna agora é a migração, e num banco que
    // ficasse para trás o `select *` traz a linha SEM a chave, com
    // `a.entrega_sem_portao` chegando `undefined` de verdade. (A conferência de
    // partida, `lib/esquema.ts`, recusa servir nesse caso — mas esta linha é a
    // defesa que não depende dela.)
    //
    // O QUE ELE DEFENDE AQUI É O TIPO, e isso basta para ele ficar. `as
    // Automation[]` acima é um cast, não uma conferência: ninguém olha o que o
    // driver devolveu, e `Automation.entrega_sem_portao` é `boolean | undefined`
    // justamente porque a coluna pode faltar em OUTROS caminhos. O destino deste
    // valor é o `checked` de uma caixa controlada; `undefined` ali faria o React
    // trocar o campo para não controlado no meio do caminho. O `Boolean`
    // normaliza para `false`, que é o lado seguro: a regra do portão contornável
    // continua impedindo publicar.
    entregaSemPortao: Boolean(a.entrega_sem_portao),
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
  // AQUI ESTEVE ESCRITO QUE COMENTÁRIO `//` ENTRE ATRIBUTOS DE JSX ENGOLE A
  // PROP SEGUINTE, "com medição". É FALSO, e o registro fica porque a frase
  // errada já custou uma mudança de código em outro arquivo: o quadro tirou uma
  // prop de dentro da lista de atributos por causa dela.
  //
  // MEDIDO COM O COMPILADOR DESTE PROJETO — `@next/swc-win32-x64-msvc`, next
  // 16.2.10, `development: true` —, compilando o arquivo EXATO em que a rota
  // caiu (a versão anterior a `ea5e09a`, com o comentário entre `configuracaoInicial`
  // e `conta`). A saída traz o comentário e a prop logo depois dele:
  //
  //     configuracaoInicial: configuracaoInicial,
  //     // A conta já foi buscada acima para saber de quem é a automação; …
  //     conta: { usuario: selected.username, nome: …, foto: … }
  //
  // No caso mínimo — `a`, comentário `//`, `b`, comentário de bloco, `c` — os
  // três sobrevivem. O mesmo vale para o `quadro.tsx` inteiro: 15 de 15 props
  // conferidas presentes, oito delas precedidas por comentário `//`.
  //
  // O QUE DERRUBOU A ROTA foi a outra metade daquele mesmo commit, e é ela que
  // segue segurando: `Previa` passou a aceitar `conta` OPCIONAL e a cair num
  // perfil vazio. Antes disso a prévia lia `conta.nome` direto, e `conta`
  // chegando `undefined` estoura dentro do componente de cliente — o que leva a
  // rota inteira junto. POR QUE ela chegou `undefined` naquele dia continua sem
  // medição, e o que se pode afirmar é o que foi medido: não foi o comentário.
  //
  // A extração para uma constante fica por leitura, não por medo.
  const contaDaPrevia = {
    usuario: selected.username,
    nome: selected.name,
    foto: selected.profile_picture_url,
  };

  return (
    <Quadro
      automationId={a.id}
      passosIniciais={passosDoBanco(a.steps)}
      ligacoesIniciais={ligacoesValidas(a.ligacoes)}
      configuracaoInicial={configuracaoInicial}
      conta={contaDaPrevia}
    />
  );
}
