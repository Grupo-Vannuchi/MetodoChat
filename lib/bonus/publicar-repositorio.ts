import "server-only";
import { pastaDaConta } from "@/lib/bucket";
import { sql } from "@/lib/db";
import { comEspaco, escolhasDaArte } from "./arte-escolhas";
import { slidesDoTexto } from "./arte-slides";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { textoDaLinhaDoCarrossel } from "./carrossel-tela";
import { ehIdDeBonus } from "./pedido";
import { estadoDaPublicacao, publicacaoLivre, type EstadoDaPublicacao, type LinhaDaFila } from "./publicar-estado";
import {
  ehCaminhoDoDestino,
  imagensDaArte,
  publicacaoDaArte,
  versaoDoTextoDoSlide,
  type JeitoDaImagem,
  type PublicacaoGuardada,
} from "./publicar-regras";
import type { RecusaDaPublicacaoDoCarrossel } from "./publicar-textos";

// O SQL DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5). Toda escrita no carrossel é feita com a linha
// travada (`for update`) ou por um `update` condicional à chave da reserva, e a fila do /publicar só
// é LIDA aqui: quem grava nela é `enqueuePublicacao` (lib/engine.ts), chamada pelo processo.
// testes-integracao/bonus-publicar-repositorio.integracao.ts é quem acusa se alguém tirar a trava.
// Objeto vai CRU para coluna `jsonb`, nunca `JSON.stringify` (a lição da FASE 1.7).

/** `sql()` ou a transação: os dois têm `query`, e a leitura da fila serve aos dois. */
type Consulta = { query: (texto: string, params?: unknown[]) => Promise<unknown[]> };

/**
 * O ESTADO DA PUBLICAÇÃO de um carrossel, pela `arte` dele: a linha da fila é lida pela chave EXATA
 * que o carrossel guardou, e o relógio é o do banco (o `now()` lido junto), porque `reservada_em`
 * também é gravado por ele.
 */
export async function estadoDaPublicacaoNa(consulta: Consulta, arte: unknown): Promise<EstadoDaPublicacao> {
  const publicacao = publicacaoDaArte(arte);
  if (publicacao === null) return { tipo: "livre" };
  const [r] = (await consulta.query(
    `select now() as agora, q.id, q.status, q.not_before, q.sent_at, q.error
       from (select 1) as um left join queue q on q.dedupe_key = $1`,
    [publicacao === "estranha" ? null : publicacao.chave]
  )) as ({ agora: Date } & Partial<LinhaDaFila>)[];
  const linha: LinhaDaFila | null = r?.id
    ? { id: r.id, status: r.status ?? "", not_before: r.not_before as Date, sent_at: r.sent_at ?? null, error: r.error ?? null }
    : null;
  return estadoDaPublicacao(publicacao, linha, r.agora);
}

/** O estado para a página, fora de transação. */
export async function estadoDoCarrossel(arte: unknown): Promise<EstadoDaPublicacao> {
  return estadoDaPublicacaoNa(sql(), arte);
}

type Recusa = { ok: false; recusa: RecusaDaPublicacaoDoCarrossel };
const recusa = (r: RecusaDaPublicacaoDoCarrossel): Recusa => ({ ok: false, recusa: r });

/**
 * GUARDAR A IMAGEM DE UM SLIDE, com a linha travada: o carrossel pronto e com conta, a trava livre, o
 * slide com espaço de imagem, e o caminho na forma exata `<pasta da conta do carrossel>/bonus/<uuid>.jpg`
 * (o slide pronto) ou `<pasta da conta do carrossel>/bonus-foto/<uuid>.jpg` (a foto do espaço, adendo
 * da Etapa 5). O jeito é o prefixo do caminho que o servidor assinou, e não se grava à parte. A versão
 * gravada é a do texto SALVO agora. Devolve a imagem anterior daquele slide, de qualquer jeito, para
 * quem chama apagá-la do bucket depois do `commit`.
 */
export async function gravarImagemDoSlide(
  id: string,
  numero: number,
  caminho: string
): Promise<{ ok: true; anterior: string | null; versao: string; jeito: JeitoDaImagem } | Recusa> {
  if (!ehIdDeBonus(id)) return recusa({ motivo: "nao_pronto" });
  return sql().begin(async (tx) => {
    const [linha] = (await tx.query(`select * from carrosseis_gerados where id = $1 for update`, [id])) as LinhaDoCarrossel[];
    const texto = linha?.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;
    if (!linha || !texto) return recusa({ motivo: "nao_pronto" });
    const escolhas = escolhasDaArte(linha.arte, linha.total_slides);
    if (!escolhas.conta) return recusa({ motivo: "sem_conta" });
    const estado = await estadoDaPublicacaoNa(tx, linha.arte);
    if (!publicacaoLivre(estado)) return recusa({ motivo: "travado", estado });
    const slide = slidesDoTexto(texto)[numero - 1];
    if (!Number.isInteger(numero) || !slide) return recusa({ motivo: "slide" });
    if (!comEspaco(escolhas, numero)) return recusa({ motivo: "sem_espaco", numero });
    const pasta = pastaDaConta(escolhas.conta);
    const jeito = ehCaminhoDoDestino(caminho, pasta, "foto") ? "foto" : ehCaminhoDoDestino(caminho, pasta, "slide") ? "slide" : null;
    if (!jeito) return recusa({ motivo: "caminho" });
    const anterior = imagensDaArte(linha.arte, linha.total_slides)[numero]?.caminho ?? null;
    const versao = versaoDoTextoDoSlide(slide);
    await tx.query(
      `update carrosseis_gerados
          set arte = arte || jsonb_build_object('imagens',
            case when jsonb_typeof(arte->'imagens') = 'object' then arte->'imagens' else '{}'::jsonb end || $2::jsonb)
        where id = $1`,
      [id, { [String(numero)]: { caminho, versao } }]
    );
    return { ok: true as const, anterior: anterior === caminho ? null : anterior, versao, jeito };
  });
}

/** Os caminhos desta lista que aparecem no payload de algum item de publicação da fila. */
export async function caminhosNaFila(caminhos: string[]): Promise<string[]> {
  const achados: string[] = [];
  for (const caminho of caminhos) {
    const [r] = (await sql().query(
      `select exists (select 1 from queue where kind = 'publicacao' and payload->'caminhos' ? $1) as achou`,
      [caminho]
    )) as { achou: boolean }[];
    if (r?.achou) achados.push(caminho);
  }
  return achados;
}

/** O que a publicação conferiu e copiou, para a reserva conferir de novo com a linha travada. */
export type ConferidoParaPublicar = {
  /** O texto salvo, como `JSON.stringify` o escreve. */
  texto: string;
  soTexto: number[];
  /** O caminho da imagem guardada de cada slide com espaço, que foi copiada. */
  imagens: Record<number, string>;
};

/**
 * A RESERVA DA PUBLICAÇÃO, numa transação curta e com a linha travada (spec, "Publicar", passo 4):
 * confere de novo a trava livre e que o texto, o "só texto" e as imagens são os que foram conferidos
 * e copiados; grava `arte.publicacao` com a chave e os caminhos, e `reservada_em` pelo relógio do
 * banco. Devolve a legenda salva, que é a que vai para a fila, e a reserva velha que nunca entrou na
 * fila, para os caminhos dela saírem do bucket.
 */
export async function reservarPublicacao(
  id: string,
  conferido: ConferidoParaPublicar,
  chave: string,
  caminhos: string[]
): Promise<{ ok: true; legenda: string; velha: PublicacaoGuardada | null } | Recusa> {
  if (!ehIdDeBonus(id)) return recusa({ motivo: "nao_pronto" });
  return sql().begin(async (tx) => {
    const [linha] = (await tx.query(`select * from carrosseis_gerados where id = $1 for update`, [id])) as LinhaDoCarrossel[];
    const texto = linha?.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;
    if (!linha || !texto) return recusa({ motivo: "nao_pronto" });
    const estado = await estadoDaPublicacaoNa(tx, linha.arte);
    if (!publicacaoLivre(estado)) return recusa({ motivo: "travado", estado });
    const escolhas = escolhasDaArte(linha.arte, linha.total_slides);
    const imagens = imagensDaArte(linha.arte, linha.total_slides);
    const atuais: Record<number, string> = {};
    for (let n = 1; n <= linha.total_slides; n++) if (comEspaco(escolhas, n) && imagens[n]) atuais[n] = imagens[n].caminho;
    const mudou =
      JSON.stringify(texto) !== conferido.texto ||
      JSON.stringify(escolhas.soTexto) !== JSON.stringify([...conferido.soTexto].sort((a, b) => a - b)) ||
      JSON.stringify(atuais) !== JSON.stringify(conferido.imagens);
    if (mudou) return recusa({ motivo: "mudou" });
    const anterior = publicacaoDaArte(linha.arte);
    await tx.query(
      `update carrosseis_gerados
          set arte = arte || jsonb_build_object('publicacao', $2::jsonb || jsonb_build_object('reservada_em', now()))
        where id = $1`,
      [id, { chave, caminhos }]
    );
    const velha = anterior && anterior !== "estranha" && !anterior.enfileiradaEm ? anterior : null;
    return { ok: true as const, legenda: texto.legenda, velha };
  });
}

/** A marca de enfileirada (achado 75), só se a reserva ainda for a desta tentativa. */
export async function marcarEnfileirada(id: string, chave: string): Promise<boolean> {
  const linhas = (await sql().query(
    `update carrosseis_gerados set arte = jsonb_set(arte, '{publicacao,enfileirada_em}', to_jsonb(now()))
      where id = $1 and arte->'publicacao'->>'chave' = $2 returning id`,
    [id, chave]
  )) as { id: string }[];
  return linhas.length > 0;
}

/** Desfaz a reserva que não entrou na fila, só se ela ainda for a desta tentativa. */
export async function desfazerReserva(id: string, chave: string): Promise<void> {
  await sql().query(`update carrosseis_gerados set arte = arte - 'publicacao' where id = $1 and arte->'publicacao'->>'chave' = $2`, [
    id,
    chave,
  ]);
}
