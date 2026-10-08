import "server-only";
import { pedidoDaChamada, type PedidoDaChamada } from "./acao-da-chamada";
import type { ContaGuardada } from "./arte-conta";
import { contextoDoLabs, contextoLivre, tituloInterno, type PedidoAvulso } from "./avulso-pedido";
import { contextoGravado, type ContextoDoCarrossel } from "./carrossel-ia-parametros";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { criarCarrosselAvulso } from "./carrossel-repositorio";
import { lerRevisaoDoCarrossel, type TextoDoCarrossel } from "./carrossel-texto";
import {
  TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO,
  quadroDaSituacao,
  textoDoTetoDoCarrossel,
  textoDosProblemasDoCarrossel,
} from "./carrossel-textos";
import type { SituacaoNoLabs } from "./publicado";
import { geracaoNaTela } from "./tempos";

// O CARROSSEL AVULSO DE PONTA A PONTA (spec da Etapa 7), fora da action: as actions só conferem a
// sessão, leem o formulário e chamam isto, e o harness da integração (que não forja sessão) prova o
// caminho daqui para baixo. As decisões moram nas funções puras (avulso-pedido.ts); aqui se costura a
// ordem: o Labs, o texto à mão, o teto e a linha.

/** Quem lê a situação de um bônus no Labs: `situacaoNoLabs` com a LABS_URL; o teste passa uma falsa. */
export type LerSituacao = (codigo: string) => Promise<SituacaoNoLabs>;

export const TEXTO_AVULSO_SEM_CONTEXTO =
  "O pedido deste carrossel foi gravado sem o tema e o conteúdo. Crie outro em Novo carrossel.";

type Recusa = { ok: false; texto: string };

/**
 * A palavra e o contexto do bônus do Labs, lidos agora pelo código, e nunca do formulário: só um
 * bônus "publicado", com palavra e tema no formato que o Chat usa, passa (`situacaoNaLista`).
 */
async function doLabs(
  codigo: string,
  oQueResolve: string,
  lerSituacao: LerSituacao
): Promise<{ ok: true; chamada: PedidoDaChamada; contexto: ContextoDoCarrossel } | Recusa> {
  const s = await lerSituacao(codigo);
  if (s.tipo !== "publicado") return { ok: false, texto: quadroDaSituacao(s).texto };
  return { ok: true, chamada: { palavra: s.bonus.palavra, acao: null }, contexto: contextoDoLabs({ codigo, ...s.bonus }, oQueResolve) };
}

/** As colunas da palavra e da ação, para gravar (`criarCarrosselAvulso`). */
function colunasDaChamada(c: PedidoDaChamada) {
  return c.palavra === null ? { palavra: null, acao: c.acao } : { palavra: c.palavra };
}

/**
 * O PEDIDO DO AVULSO, já lido (`lerPedidoAvulso`). Do Labs, a palavra e o contexto vêm de lá; do texto
 * livre, do formulário. Escrito à mão, `bruto` são os campos do carrossel, conferidos inteiros contra
 * a palavra (`lerRevisaoDoCarrossel`, a conferência da Etapa 2), e o carrossel nasce pronto. Pela IA,
 * ele nasce pendente e quem chama dispara a geração (`gerar`). A conta é a logada, que a action lê
 * do cookie.
 */
export async function pedirAvulso(p: {
  pedido: PedidoAvulso;
  bruto: Record<string, unknown>;
  conta: ContaGuardada | null;
  lerSituacao: LerSituacao;
}): Promise<{ ok: true; id: string; gerar: boolean } | Recusa> {
  const { pedido } = p;
  const origem =
    pedido.origem === "labs"
      ? await doLabs(pedido.codigo, pedido.destaque, p.lerSituacao)
      : { ok: true as const, chamada: { palavra: pedido.palavra, acao: null } as PedidoDaChamada, contexto: contextoLivre(pedido) };
  if (!origem.ok) return origem;

  let texto: TextoDoCarrossel | null = null;
  if (pedido.jeito === "mao") {
    const lido = lerRevisaoDoCarrossel(pedido.total, origem.chamada.palavra, tituloInterno(origem.contexto), p.bruto);
    if (!lido.ok) return { ok: false, texto: `Corrija antes de criar. ${textoDosProblemasDoCarrossel(pedido.total, lido.problemas)}` };
    texto = lido.texto;
  }

  const criado = await criarCarrosselAvulso({
    origem: pedido.origem,
    labsCodigo: pedido.origem === "labs" ? pedido.codigo : null,
    total: pedido.total,
    ...colunasDaChamada(origem.chamada),
    contexto: origem.contexto,
    conta: p.conta,
    texto,
  });
  if (!criado.ok) return { ok: false, texto: textoDoTetoDoCarrossel() };
  return { ok: true, id: criado.id, gerar: texto === null };
}

/**
 * O "GERAR DE NOVO" DO AVULSO: um carrossel novo, da mesma origem e com o mesmo total, a partir do que
 * falhou ou travou. O do Labs relê o Labs pelo código, como o de bônus faz (`gerarCarrosselDeNovo`), e
 * mantém o destaque gravado; o do texto livre reaproveita o tema, o conteúdo e a palavra gravados (ou,
 * sem palavra, a ação: spec da Etapa 8), porque não há outro lugar de onde lê-los. A conta é a do original (`contaParaGerarDeNovo`, na action).
 */
export async function gerarAvulsoDeNovo(p: {
  linha: LinhaDoCarrossel;
  conta: ContaGuardada | null;
  lerSituacao: LerSituacao;
  agora: number;
}): Promise<{ ok: true; id: string } | Recusa> {
  const { linha } = p;
  const naTela = geracaoNaTela(linha.estado, linha.criado_em, p.agora);
  if (naTela !== "falhou" && naTela !== "travou") return { ok: false, texto: TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO };

  const gravado = contextoGravado(linha.contexto);
  let origem: { ok: true; chamada: PedidoDaChamada; contexto: ContextoDoCarrossel } | Recusa;
  if (linha.origem === "labs" && linha.labs_codigo) {
    const destaque = gravado && !("tipo" in gravado) ? gravado.oQueResolve : "";
    origem = await doLabs(linha.labs_codigo, destaque, p.lerSituacao);
  } else if (linha.origem === "livre" && gravado && "tipo" in gravado) {
    const chamada = pedidoDaChamada(linha);
    origem = chamada ? { ok: true, chamada, contexto: gravado } : { ok: false, texto: TEXTO_AVULSO_SEM_CONTEXTO };
  } else {
    origem = { ok: false, texto: TEXTO_AVULSO_SEM_CONTEXTO };
  }
  if (!origem.ok) return origem;

  const criado = await criarCarrosselAvulso({
    origem: linha.origem === "labs" ? "labs" : "livre",
    labsCodigo: linha.origem === "labs" ? linha.labs_codigo : null,
    total: linha.total_slides,
    ...colunasDaChamada(origem.chamada),
    contexto: origem.contexto,
    conta: p.conta,
    texto: null,
  });
  return criado.ok ? { ok: true, id: criado.id } : { ok: false, texto: textoDoTetoDoCarrossel() };
}
