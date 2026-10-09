import "server-only";
import type { ContaDoCabecalho } from "./arte-conta";
import { comEspaco } from "./arte-escolhas";
import { medidasDoJpeg } from "./imagem-jpeg";
import { gerarNaOpenAI, type GerarNaOpenAI } from "./imagem-openai";
import { problemaDaImagemGerada } from "./imagem-regras";
import { marcarFalhou, marcarPronta as marcarProntaNoBanco, reservarImagem } from "./imagem-repositorio";
import { TEXTO_IMAGEM_FALHOU_SEM_MOTIVO, TEXTO_IMAGEM_NAO_SUBIU, textoDoProblemaDaImagem, type RecusaDaImagem } from "./imagem-textos";
import { validarDescricao } from "./prompt-ilustracao";
import { apagarSemDerrubar } from "./publicar-bucket";
import { assinarImagem, conferirCarrossel, guardarImagem } from "./publicar-processo";
import { textoDaRecusaDaPublicacaoDoCarrossel } from "./publicar-textos";

// O PROCESSO DO CRIADOR DE IMAGEM (spec da Etapa 6, "Pedir e acompanhar"), em duas partes.
//
// O PEDIDO (`pedirImagem`) roda dentro da action e responde na hora: confere o carrossel como o publicar
// confere, o slide, a descrição e a chave, e reserva no teto. Tudo isso recusa sem chamar a OpenAI, ou
// seja, sem custo. A action não espera a imagem, porque o Next manda as actions de um cliente uma de
// cada vez (achado 88): esperar 30 s prenderia o resto da página.
//
// A GERAÇÃO (`gerarImagem`) roda no `after()` da mesma action: chama a OpenAI, confere a imagem, sobe ao
// bucket e guarda no slide pelo mesmo caminho do "Subir foto" (`assinarImagem` e `guardarImagem`), que
// conferem de novo o carrossel. Para a rota da arte e para o publicar, a imagem gerada é uma foto.
//
// O QUE SAI DO BUCKET NUMA FALHA (achado 89): enquanto o `guardarImagem` não confirmou, a falha apaga o
// arquivo que subiu. Depois dele, o arquivo é a foto do slide, e a anterior já saiu do bucket: uma falha
// ao marcar a linha deixa o arquivo, e a linha `gerando` vence pelo prazo e conta no teto.

export type PedidoDaImagem = { ok: true; reservaId: string; hoje: number } | { ok: false; recusa: RecusaDaImagem; hoje?: number };

/** PEDIR UMA IMAGEM: as conferências que não custam nada, e a reserva no teto. */
export async function pedirImagem(p: {
  id: string;
  numero: number;
  descricao: string;
  contas: ContaDoCabecalho[];
  /** Só para o teste: em produção, o ambiente do servidor. */
  ambiente?: Readonly<Record<string, string | undefined>>;
}): Promise<PedidoDaImagem> {
  const ambiente = p.ambiente ?? process.env;
  const c = await conferirCarrossel(p.id, p.contas);
  if (!c.ok) return c;
  if (!Number.isInteger(p.numero) || !c.slides[p.numero - 1]) return { ok: false, recusa: { motivo: "slide" } };
  if (!comEspaco(c.escolhas, p.numero)) return { ok: false, recusa: { motivo: "sem_espaco", numero: p.numero } };
  const descricao = validarDescricao(p.descricao);
  if (!descricao.ok) return { ok: false, recusa: { motivo: "descricao", texto: descricao.mensagem } };
  if (!ambiente.OPENAI_API_KEY?.trim()) return { ok: false, recusa: { motivo: "sem_chave" } };
  const r = await reservarImagem({ carrosselId: c.linha.id, numero: p.numero, descricao: p.descricao.trim() });
  return r.ok ? { ok: true, reservaId: r.id, hoje: r.hoje } : { ok: false, recusa: { motivo: r.motivo }, hoje: r.hoje };
}

/**
 * GERAR A IMAGEM DE UMA RESERVA, no `after()`. A OpenAI, o guardar e a marca da linha entram por
 * parâmetro só para o teste: em produção são os de verdade.
 */
export async function gerarImagem(p: {
  reservaId: string;
  id: string;
  numero: number;
  descricao: string;
  contas: ContaDoCabecalho[];
  gerar?: GerarNaOpenAI;
  guardar?: typeof guardarImagem;
  marcarPronta?: typeof marcarProntaNoBanco;
}): Promise<{ ok: true; caminho: string } | { ok: false; motivo: string }> {
  const gerar = p.gerar ?? ((descricao: string) => gerarNaOpenAI(descricao));
  const guardar = p.guardar ?? guardarImagem;
  const marcarPronta = p.marcarPronta ?? marcarProntaNoBanco;
  let subido: string | null = null;
  const falhar = async (motivo: string) => {
    if (subido) await apagarSemDerrubar([subido]);
    try {
      await marcarFalhou(p.reservaId, motivo);
    } catch {
      // Sem a marca, a linha `gerando` vence pelo prazo, aparece como falha e conta no teto.
    }
    return { ok: false as const, motivo };
  };

  let caminho: string;
  try {
    const r = await gerar(p.descricao);
    if (!r.ok) return falhar(r.erro);
    const problema = problemaDaImagemGerada(r.bytes);
    const medidas = medidasDoJpeg(r.bytes);
    if (problema || !medidas) return falhar(textoDoProblemaDaImagem(problema ?? "formato"));
    const arquivo = { nome: "imagem-gerada.jpg", mime: "image/jpeg", bytes: r.bytes.length, largura: medidas.largura, altura: medidas.altura };
    const assinado = await assinarImagem({ id: p.id, numero: p.numero, destino: "foto", arquivo, contas: p.contas });
    if (!assinado.ok) return falhar(textoDaRecusaDaPublicacaoDoCarrossel(assinado.recusa));
    // A cópia dos bytes dá ao `fetch` o tipo que ele aceita como corpo (`Uint8Array<ArrayBuffer>`).
    const subida = await fetch(assinado.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: new Uint8Array(r.bytes) });
    if (!subida.ok) return falhar(TEXTO_IMAGEM_NAO_SUBIU);
    subido = assinado.caminho;
    const guardado = await guardar({ id: p.id, numero: p.numero, caminho: assinado.caminho, contas: p.contas });
    if (!guardado.ok) return falhar(textoDaRecusaDaPublicacaoDoCarrossel(guardado.recusa));
    caminho = assinado.caminho;
  } catch {
    return falhar(TEXTO_IMAGEM_FALHOU_SEM_MOTIVO);
  }

  // DEPOIS DO GUARDAR, O ARQUIVO É A FOTO DO SLIDE (achado 89): a falha ao marcar a linha não o apaga.
  try {
    await marcarPronta(p.reservaId, caminho);
  } catch {
    // A linha `gerando` vence pelo prazo, aparece como falha e conta no teto; a foto fica no slide.
  }
  return { ok: true, caminho };
}
