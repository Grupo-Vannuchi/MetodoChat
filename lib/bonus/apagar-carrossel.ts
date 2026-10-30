import "server-only";
import { pastaDaConta } from "@/lib/bucket";
import { sql } from "@/lib/db";
import { caminhosDoCarrossel, podeApagar, type PodeApagar } from "./apagar-regras";
import { escolhasDaArte } from "./arte-escolhas";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { TRAVADA_IMAGEM_MS } from "./imagem-regras";
import { ehIdDeBonus } from "./pedido";
import { apagarSemDerrubar } from "./publicar-bucket";
import { caminhosNaFila, estadoDaPublicacaoNa, estadoDoCarrossel } from "./publicar-repositorio";
import { geracaoNaTela, type GeracaoNaTela } from "./tempos";

// O APAGAR NO SERVIDOR (spec da Etapa 10, "O apagar no servidor"). A linha é travada (`for update`),
// como no agendar e no salvar: o apagar e um agendar ao mesmo tempo não passam os dois. A reserva de uma
// imagem trava a linha em `key share`, pela chave estrangeira da 018, e espera pelo apagar (e vice-versa).
// testes-integracao/bonus-apagar-carrossel.integracao.ts é quem acusa se alguém tirar a trava.

/** `sql()` ou a transação: os dois têm `query`. */
type Consulta = { query: (texto: string, params?: unknown[]) => Promise<unknown[]> };

/**
 * Alguma imagem do carrossel sendo gerada (Etapa 6), pelo relógio do banco: a linha `gerando` dentro do
 * prazo. A que passou de `TRAVADA_IMAGEM_MS` é travada, e não segura o apagar (achado 95).
 */
async function imagemGerandoNa(consulta: Consulta, id: string): Promise<boolean> {
  const [r] = (await consulta.query(
    `select exists (
       select 1 from imagens_geradas
        where carrossel_id = $1 and estado = 'gerando'
          and criado_em > now() - $2::int * interval '1 millisecond') as gerando`,
    [id, TRAVADA_IMAGEM_MS]
  )) as { gerando: boolean }[];
  return r?.gerando === true;
}

/** O QUE A PÁGINA MOSTRA NO FIM, fora de transação: a mesma regra que o servidor confere ao apagar. */
export async function podeApagarAgora(l: LinhaDoCarrossel, geracao: GeracaoNaTela): Promise<PodeApagar> {
  const [publicacao, imagemGerando] = await Promise.all([estadoDoCarrossel(l.arte), imagemGerandoNa(sql(), l.id)]);
  return podeApagar({ publicacao, geracao, imagemGerando });
}

/**
 * APAGAR UM CARROSSEL, numa transação: trava a linha, lê a publicação e as imagens dela pelo relógio do
 * banco, confere `podeApagar` e apaga (`delete … returning`, exigindo a linha). As linhas de
 * `imagens_geradas` ficam com o carrossel nulo (`on delete set null`, a 018: são o histórico do teto), e
 * as da fila ficam, como histórico.
 *
 * DEPOIS DO COMMIT, os arquivos dele saem do bucket (`caminhosDoCarrossel`), menos os que ainda estão no
 * payload de um item da fila (achado 97): o item que falhou mantém o arquivo, pela regra do dono
 * (lib/queue-drain.ts:301-303), como o publicar já faz (`caminhosNaFila`). Uma falha no bucket não desfaz o
 * banco: o carrossel já está apagado, e o arquivo fica sem dono. `apagar` entra por parâmetro só para o
 * teste: em produção é `apagarSemDerrubar`.
 */
export async function apagarCarrossel(id: string, apagar: (caminhos: string[]) => Promise<void> = apagarSemDerrubar): Promise<PodeApagar> {
  if (!ehIdDeBonus(id)) return { ok: false, motivo: "nao_existe" };
  const r = await sql().begin(async (tx) => {
    const [linha] = (await tx.query(`select * from carrosseis_gerados where id = $1 for update`, [id])) as LinhaDoCarrossel[];
    if (!linha) return { ok: false as const, motivo: "nao_existe" as const };
    const [relogio] = (await tx.query(`select now() as agora`)) as { agora: Date }[];
    const pode = podeApagar({
      publicacao: await estadoDaPublicacaoNa(tx, linha.arte),
      geracao: geracaoNaTela(linha.estado, linha.criado_em, relogio.agora.getTime()),
      imagemGerando: await imagemGerandoNa(tx, id),
    });
    if (!pode.ok) return pode;
    const apagadas = await tx.query(`delete from carrosseis_gerados where id = $1 returning id`, [id]);
    if (apagadas.length !== 1) return { ok: false as const, motivo: "nao_existe" as const };
    const { conta } = escolhasDaArte(linha.arte, linha.total_slides);
    return { ok: true as const, caminhos: caminhosDoCarrossel(linha.arte, linha.total_slides, conta ? pastaDaConta(conta) : null) };
  });
  if (!r.ok) return r;
  const naFila = await caminhosNaFila(r.caminhos);
  await apagar(r.caminhos.filter((c) => !naFila.includes(c)));
  return { ok: true };
}
