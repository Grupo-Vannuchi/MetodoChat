import "server-only";
import { pastaDaConta, tetoDoBucket } from "@/lib/bucket";
import { publicacaoKey } from "@/lib/dedupe";
import { enqueuePublicacao } from "@/lib/engine";
import {
  decisaoDeAssinatura,
  problemaDaLegenda,
  recusaDaQuantidade,
  textoDaRecusaDaPublicacao,
  textoDoProblemaDaLegenda,
} from "@/lib/publicacao";
import { drainQueue } from "@/lib/queue-drain";
import { resolverConta, type ContaDoCabecalho } from "./arte-conta";
import { comEspaco, escolhasDaArte, type EscolhasDaArte } from "./arte-escolhas";
import { slidesDoTexto, type SlideParaArte } from "./arte-slides";
import { cabecalhoParaVersao, versoesDosSlides } from "./arte-tela";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { lerCarrossel } from "./carrossel-repositorio";
import { textoDaLinhaDoCarrossel } from "./carrossel-tela";
import type { TextoDoCarrossel } from "./carrossel-texto";
import { apagarSemDerrubar, assinarCaminho, copiarTodasParaAFila } from "./publicar-bucket";
import { slidesQueSaemCortados } from "./publicar-cabimento";
import { publicacaoLivre } from "./publicar-estado";
import {
  caminhosNaFila,
  desfazerReserva,
  estadoDoCarrossel,
  gravarImagemDoSlide,
  marcarEnfileirada,
  reservarPublicacao,
} from "./publicar-repositorio";
import {
  ehCaminhoDoDestino,
  formaDoCarrossel,
  fotosDaArte,
  imagensDaArte,
  problemaDaFotoDoEspaco,
  problemaDaProporcaoDoSlide,
  versaoDoDesenho,
  type DestinoDaImagem,
  type JeitoDaImagem,
} from "./publicar-regras";
import type { RecusaDaPublicacaoDoCarrossel } from "./publicar-textos";

// O PROCESSO DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5, "Por dentro"): assinar, guardar e publicar.
// As actions (app/bonus/publicar-actions.ts) conferem a sessão, leem o formulário e chamam daqui; tudo
// o que decide e grava mora aqui, onde a integração alcança (o harness não forja sessão, de propósito).
//
// A CONTA É SEMPRE A DO CARROSSEL, gravada e conectada (origem `gravada` de `resolverConta`). O cookie
// não entra: nem para a pasta do bucket, nem para a fila.

type Recusa = { ok: false; recusa: RecusaDaPublicacaoDoCarrossel };
const recusa = (r: RecusaDaPublicacaoDoCarrossel): Recusa => ({ ok: false, recusa: r });

type CarrosselConferido = {
  ok: true;
  linha: LinhaDoCarrossel;
  texto: TextoDoCarrossel;
  escolhas: EscolhasDaArte;
  slides: SlideParaArte[];
  conta: string;
};

/** O que as três operações conferem antes de tudo: pronto, com conta gravada e conectada, e a trava livre. */
async function conferirCarrossel(id: string, contas: ContaDoCabecalho[]): Promise<CarrosselConferido | Recusa> {
  const linha = await lerCarrossel(id);
  const texto = linha?.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;
  if (!linha || !texto) return recusa({ motivo: "nao_pronto" });
  const escolhas = escolhasDaArte(linha.arte, linha.total_slides);
  const { origem } = resolverConta(contas, escolhas, undefined);
  if (origem === "selecionada") return recusa({ motivo: "sem_conta" });
  if (origem !== "gravada" || !escolhas.conta) return recusa({ motivo: "conta_desconectada" });
  const estado = await estadoDoCarrossel(linha.arte);
  if (!publicacaoLivre(estado)) return recusa({ motivo: "travado", estado });
  return { ok: true, linha, texto, escolhas, slides: slidesDoTexto(texto), conta: escolhas.conta };
}

const numero = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const mensagem = (e: unknown) => (e instanceof Error && e.message ? e.message : "erro sem mensagem");

/**
 * ASSINAR O UPLOAD DE UMA IMAGEM: no destino `slide`, o slide pronto do Canva de um slide com espaço;
 * no destino `foto`, a foto do espaço da arte (adendo da Etapa 5); no destino `fila`, a arte de um
 * slide que sai com a arte do Chat (o "Só texto" e o com foto), convertida no navegador na hora de
 * publicar. Só JPEG: a foto na proporção do espaço e até 2 MB (achado 79), o resto em 4:5; e tudo
 * pela `decisaoDeAssinatura` do /publicar com a forma do carrossel. As medidas são declaradas pelo
 * navegador, como no /publicar.
 */
export async function assinarImagem(p: {
  id: string;
  numero: number;
  destino: DestinoDaImagem;
  arquivo: unknown;
  contas: ContaDoCabecalho[];
}): Promise<{ ok: true; caminho: string; url: string } | Recusa> {
  const c = await conferirCarrossel(p.id, p.contas);
  if (!c.ok) return c;
  if (!Number.isInteger(p.numero) || !c.slides[p.numero - 1]) return recusa({ motivo: "slide" });
  const espaco = comEspaco(c.escolhas, p.numero);
  const desenhado = !espaco || fotosDaArte(c.linha.arte, c.linha.total_slides)[p.numero] !== undefined;
  if (p.destino !== "fila" && !espaco) return recusa({ motivo: "sem_espaco", numero: p.numero });
  if (p.destino === "fila" && !desenhado) return recusa({ motivo: "nao_e_so_texto", numero: p.numero });
  const arquivo = (p.arquivo !== null && typeof p.arquivo === "object" ? p.arquivo : {}) as Record<string, unknown>;
  if (arquivo.mime !== "image/jpeg") return recusa({ motivo: "tipo" });
  if (p.destino === "foto") {
    const foto = problemaDaFotoDoEspaco(numero(arquivo.largura), numero(arquivo.altura), numero(arquivo.bytes));
    if (foto) return recusa({ motivo: "foto", problema: foto });
  } else {
    const proporcao = problemaDaProporcaoDoSlide(numero(arquivo.largura), numero(arquivo.altura));
    if (proporcao) return recusa({ motivo: "proporcao", problema: proporcao });
  }
  try {
    const decisao = decisaoDeAssinatura({ ...arquivo, forma: formaDoCarrossel(c.linha.total_slides) }, await tetoDoBucket());
    if (!decisao.ok) return recusa({ motivo: "arquivo", texto: decisao.erro });
    return { ok: true, ...(await assinarCaminho(c.conta, p.destino)) };
  } catch (e) {
    return recusa({ motivo: "armazenamento", texto: mensagem(e) });
  }
}

/**
 * GUARDAR A IMAGEM SUBIDA NO SLIDE. A anterior, de qualquer jeito, sai do bucket depois do `commit`,
 * sem derrubar a troca. Devolve o jeito, que o repositório leu do caminho, e a versão nova da
 * miniatura daquele slide: a foto muda o desenho, e o slide pronto o devolve ao espaço em branco.
 */
export async function guardarImagem(p: {
  id: string;
  numero: number;
  caminho: unknown;
  contas: ContaDoCabecalho[];
}): Promise<{ ok: true; versao: string; jeito: JeitoDaImagem; versaoDaMiniatura: string } | Recusa> {
  const c = await conferirCarrossel(p.id, p.contas);
  if (!c.ok) return c;
  if (typeof p.caminho !== "string") return recusa({ motivo: "caminho" });
  const r = await gravarImagemDoSlide(p.id, p.numero, p.caminho);
  if (!r.ok) return r;
  if (r.anterior) await apagarSemDerrubar([r.anterior]);
  const fotos = { ...fotosDaArte(c.linha.arte, c.linha.total_slides) };
  if (r.jeito === "foto") fotos[p.numero] = p.caminho;
  else delete fotos[p.numero];
  const { conta } = resolverConta(p.contas, c.escolhas, undefined);
  const versaoDaMiniatura = versoesDosSlides(c.slides, c.escolhas.soTexto, cabecalhoParaVersao(conta), fotos)[p.numero - 1];
  return { ok: true, versao: r.versao, jeito: r.jeito, versaoDaMiniatura };
}

/** A arte de um slide que sai com a arte do Chat (o "Só texto" e o com foto), subida pelo navegador na hora de publicar. */
export type ArteSubida = { numero: number; caminho: unknown; versao: unknown };

/**
 * PUBLICAR OU AGENDAR (spec, "Publicar"): confere tudo antes de tocar o bucket; copia os slides
 * prontos guardados para a fila, fora de qualquer transação; reserva com a linha travada, conferindo
 * de novo; enfileira na conta do carrossel; marca a reserva como enfileirada (achado 75); e, com
 * "agora", drena a fila como o /publicar. Em qualquer recusa depois do navegador ter subido as artes,
 * as artes e as cópias desta tentativa saem do bucket.
 *
 * O SLIDE COM FOTO PUBLICA A ARTE DESENHADA, e não a foto (adendo da Etapa 5): ele vai com as artes
 * "Só texto", que o navegador baixou da rota e subiu em `bonus-fila`, com a versão do desenho (o
 * texto e o caminho da foto). A foto guardada nunca vai para a fila, nem como cópia.
 *
 * `enfileirar` e `drenar` entram por parâmetro só para o teste: em produção são as do /publicar.
 */
export async function publicarNaFila(p: {
  id: string;
  quando: Date | null;
  artes: ArteSubida[];
  contas: ContaDoCabecalho[];
  enfileirar?: typeof enqueuePublicacao;
  drenar?: () => Promise<unknown>;
}): Promise<{ ok: true; quando: Date | null } | Recusa> {
  const enfileirar = p.enfileirar ?? enqueuePublicacao;
  const drenar = p.drenar ?? drainQueue;
  const c = await conferirCarrossel(p.id, p.contas);
  if (!c.ok) return c;
  const total = c.linha.total_slides;
  const forma = formaDoCarrossel(total);
  const quantidade = recusaDaQuantidade(forma, total);
  if (quantidade) return recusa({ motivo: "quantidade", texto: textoDaRecusaDaPublicacao(quantidade) });

  const imagens = imagensDaArte(c.linha.arte, total);
  const comImagem = c.slides.filter((s) => comEspaco(c.escolhas, s.numero));
  const faltam = comImagem.filter((s) => !imagens[s.numero]).map((s) => s.numero);
  if (faltam.length) return recusa({ motivo: "faltam_imagens", slides: faltam });
  // OS SLIDES QUE SAEM COM A ARTE DO CHAT: o "Só texto" e o com foto. O resto sai com a cópia do slide
  // pronto. A foto de cada um é a do slide com espaço; no "Só texto" a foto guardada não conta.
  const fotos = fotosDaArte(c.linha.arte, total);
  const fotoDe = (n: number) => (comEspaco(c.escolhas, n) ? (fotos[n] ?? null) : null);
  const desenhados = c.slides.filter((s) => !comEspaco(c.escolhas, s.numero) || fotoDe(s.numero) !== null).map((s) => s.numero);

  // AS ARTES, conferidas antes de tudo. Os caminhos que o navegador subiu só servem para apagar numa
  // recusa quando passam na forma exata de `bonus-fila` da pasta do carrossel e não estão em payload
  // nenhum da fila: sem isso, um pedido montado à mão faria esta tentativa apagar o arquivo de outro
  // post.
  const pasta = pastaDaConta(c.conta);
  const subidas = p.artes.filter((a) => ehCaminhoDoDestino(a.caminho, pasta, "fila")).map((a) => a.caminho as string);
  const descartaveis = subidas.filter((x, i) => subidas.indexOf(x) === i);
  const naFila = await caminhosNaFila(descartaveis);
  const descartar = (outros: string[] = []) => apagarSemDerrubar([...outros, ...descartaveis.filter((x) => !naFila.includes(x))]);
  if (naFila.length) {
    await descartar();
    return recusa({ motivo: "caminho_na_fila" });
  }
  // O SLIDE QUE SAI CORTADO NÃO SAI (spec da Etapa 9, achado 87): a conta da arte no modo em que cada
  // slide sai, sobre o texto salvo. Vem depois do `descartar`, para as artes que o navegador subiu
  // saírem do bucket na recusa, e antes de conferir as artes, reservar e enfileirar.
  const cortados = slidesQueSaemCortados(c.slides, desenhados.map((n) => ({ numero: n, comFoto: fotoDe(n) !== null })));
  if (cortados.slides.length) {
    await descartar();
    return recusa({ motivo: "nao_cabe", ...cortados });
  }
  const artes = new Map<number, string>();
  for (const a of p.artes) {
    if (!desenhados.includes(a.numero)) {
      await descartar();
      return recusa({ motivo: "nao_e_so_texto", numero: a.numero });
    }
  }
  for (const n of desenhados) {
    const a = p.artes.find((x) => x.numero === n);
    const caminho = a?.caminho;
    if (!a || !ehCaminhoDoDestino(caminho, pasta, "fila") || [...artes.values()].includes(caminho)) {
      await descartar();
      return recusa({ motivo: "arte_so_texto", numero: n });
    }
    if (a.versao !== versaoDoDesenho(c.slides[n - 1], fotoDe(n))) {
      await descartar();
      return recusa({ motivo: "arte_velha", numero: n });
    }
    artes.set(n, caminho);
  }

  const legenda = c.texto.legenda.trim();
  const problema = problemaDaLegenda(legenda);
  if (problema) {
    await descartar();
    return recusa({ motivo: "legenda", texto: textoDoProblemaDaLegenda(problema) });
  }

  // AS CÓPIAS, só dos slides prontos e fora de qualquer transação: segurar a linha enquanto se baixa e
  // sobe até 10 imagens prenderia uma conexão por segundos e travaria os outros salvamentos do carrossel.
  const origens = comImagem
    .filter((s) => !desenhados.includes(s.numero))
    .map((s) => ({ numero: s.numero, caminho: imagens[s.numero].caminho }));
  const copiadas = await copiarTodasParaAFila(origens, c.conta);
  if (!copiadas.ok) {
    await descartar();
    return recusa({ motivo: "copia", numero: copiadas.numero });
  }
  const caminhos = c.slides.map((s) => (desenhados.includes(s.numero) ? (artes.get(s.numero) as string) : copiadas.copias[s.numero]));
  const chave = publicacaoKey(c.conta, forma, caminhos);

  // A reserva confere de novo TODAS as imagens dos slides com espaço, as fotos inclusive: a arte com
  // foto foi desenhada com a foto que estava guardada na hora.
  const reserva = await reservarPublicacao(
    p.id,
    {
      texto: JSON.stringify(c.texto),
      soTexto: c.escolhas.soTexto,
      imagens: Object.fromEntries(comImagem.map((s) => [s.numero, imagens[s.numero].caminho])),
    },
    chave,
    caminhos
  );
  if (!reserva.ok) {
    await descartar(Object.values(copiadas.copias));
    return reserva;
  }
  if (reserva.velha) {
    // A RESERVA VELHA, QUE NUNCA ENTROU NA FILA, sai do bucket: o que está em payload da fila fica,
    // e o que esta tentativa vai publicar também (revisão do plano: um pedido montado à mão que
    // repetisse a arte da reserva velha apagaria um arquivo do post que está entrando).
    const daVelhaNaFila = await caminhosNaFila(reserva.velha.caminhos);
    await apagarSemDerrubar(reserva.velha.caminhos.filter((x) => !daVelhaNaFila.includes(x) && !caminhos.includes(x)));
  }

  let entrou = false;
  try {
    entrou = await enfileirar(c.conta, { forma, caminhos, legenda: reserva.legenda }, p.quando);
  } catch {
    entrou = false;
  }
  if (!entrou) {
    await desfazerReserva(p.id, chave);
    await descartar(Object.values(copiadas.copias));
    return recusa({ motivo: "fila" });
  }

  // A MARCA DE ENFILEIRADA (achado 75). Se ela falhar, o post já está na fila e a resposta é de
  // sucesso: a linha da fila existe, e o estado vem dela.
  try {
    await marcarEnfileirada(p.id, chave);
  } catch {
    // O resíduo está escrito na spec: a marca falhar E a conta ser desconectada depois.
  }

  // ENFILEIRAR NÃO ENVIA (app/publicar/actions.ts:136-159): "agora" nasce com atraso zero, e sem a
  // drenagem o post sairia no próximo tique. O agendado não drena.
  if (p.quando === null) {
    try {
      await drenar();
    } catch {
      // A trava atômica do dreno garante que o próximo recupera; o estado na página diz "publicando".
    }
  }
  return { ok: true, quando: p.quando };
}
