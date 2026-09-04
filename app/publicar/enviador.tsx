"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  planoDaConversao,
  nomeDepoisDaConversao,
  problemaDoArquivo,
  textoDoProblema,
  problemaDaLegenda,
  textoDoProblemaDaLegenda,
  tiposQueOCampoAceita,
  resumoDoProgresso,
  rotuloDoEnvio,
  moverNaOrdem,
  recusaDaQuantidade,
  textoDaRecusaDaPublicacao,
  CARROSSEL_ITENS_MAX,
  type FormaDePublicacao,
} from "@/lib/publicacao";
import {
  assinarEnvios,
  lerEnvios,
  lerEnviosNoServidor,
  definirEnvios,
  atualizarEnvio,
  limparEnvios,
} from "./envios";
import { card, input, label, hint, fieldError, muted } from "../ui";

// O ENVIADOR — a exceção declarada na especificação (§3), e a única razão de
// haver `"use client"` neste projeto fora do que já existia.
//
// =============================================================================
// POR QUE O NAVEGADOR É QUEM ENVIA
//
// A Vercel recusa corpo de requisição acima de 4,5 MB (medido), e um reels vai
// a 300 MB. Não existe versão em servidor deste recurso: o arquivo tem de ir do
// navegador direto ao bucket, com uma URL assinada que vale para um caminho só.
// E como é o navegador que envia, é ele — e só ele — que sabe o andamento.
//
// `fetch` NÃO DÁ PROGRESSO DE UPLOAD. Não é preferência: a API não expõe o
// progresso do corpo que sobe (só o que desce, por `response.body`). É
// `XMLHttpRequest` com `upload.onprogress`, ou é nada. Ver `subirComProgresso`,
// no fim do arquivo.
//
// =============================================================================
// O CONTORNO: NENHUMA DECISÃO MORA AQUI
//
// A suíte não testa componente. Tudo o que este arquivo pergunta sobre regra de
// negócio já vem respondido de `lib/publicacao.ts`, que é puro e tem caso para
// cada saída: se converte (`planoDaConversao`), com que nome
// (`nomeDepoisDaConversao`), se o arquivo serve (`problemaDoArquivo`), o que
// dizer quando não serve (`textoDoProblema`), o que o seletor oferece
// (`tiposQueOCampoAceita`) e o que há de errado na legenda
// (`problemaDaLegenda` / `textoDoProblemaDaLegenda`).
//
// O que sobra aqui é fiação: ler o arquivo, medir, desenhar no `canvas`, falar
// com a rota que assina e empurrar bytes. Um `if` sobre regra de negócio neste
// arquivo está no lugar errado — o lugar é `lib/publicacao.ts`, com teste.

/** Um arquivo que já está no bucket, na ordem em que vai ser publicado. O
 *  `rotulo` é o mesmo que a janelinha mostra (ver `rotuloDoEnvio`), para as
 *  duas listas nomearem o arquivo do mesmo jeito. */
type ItemEnviado = { caminho: string; rotulo: string };

export default function Enviador({ teto }: { teto: number | null }) {
  const [forma, setForma] = useState<FormaDePublicacao>("imagem");
  const [legenda, setLegenda] = useState("");
  const [itens, setItens] = useState<ItemEnviado[]>([]);
  const campoDeArquivo = useRef<HTMLInputElement>(null);
  const campoDeFuso = useRef<HTMLInputElement>(null);

  const envios = useSyncExternalStore(assinarEnvios, lerEnvios, lerEnviosNoServidor);

  // O FUSO É ESCRITO NO DOM DEPOIS DA HIDRATAÇÃO, e não durante o render: o
  // servidor roda em UTC e o navegador não, então um `value` calculado no
  // render seria diferente dos dois lados e o React acusaria divergência de
  // hidratação. O campo nasce vazio nos dois, e ganha o número antes de
  // qualquer clique humano.
  //
  // É um `ref` e não um `useState` porque isto é exatamente o que um efeito
  // deve fazer — levar ao mundo de fora (o DOM) um dado que só existe lá. Um
  // `setState` aqui seria um render em cascata por um valor que ninguém desenha
  // (o campo é `hidden`), e o próprio lint desta base acusa.
  //
  // Ele existe porque o `<input type="datetime-local">` manda "14:30" e CALA
  // sobre onde são 14:30; ver `instanteDoAgendamento` (lib/publicacao.ts) para
  // as três horas de diferença que isso custaria.
  useEffect(() => {
    if (campoDeFuso.current) {
      campoDeFuso.current.value = String(new Date().getTimezoneOffset());
    }
  }, []);

  // A JANELINHA NÃO ATRAVESSA UM PEDIDO NOVO. Depois de publicar, o `redirect`
  // traz a tela de volta e o depósito — que é um módulo, e sobrevive — ainda
  // guarda o envio ENCERRADO do pedido anterior. Ele ficaria no canto dizendo
  // "envio concluído" sobre um arquivo que já virou post.
  //
  // Só o que está ENCERRADO é limpo, e quem responde isso é `resumoDoProgresso`
  // — um envio ainda andando é justamente o caso que a janelinha existe para
  // mostrar, e apagá-lo aqui abandonaria um upload vivo sem dizer a ninguém.
  useEffect(() => {
    if (resumoDoProgresso(lerEnvios())?.encerrado) limparEnvios();
  }, []);

  const problemaDaLegendaAtual = problemaDaLegenda(legenda);
  // A CONTAGEM AVISA, E NÃO RECUSA — quem recusa é a ação de servidor, com a
  // MESMA função e a MESMA frase. Aqui ela existe para a pessoa descobrir que
  // faltou uma peça antes de clicar, e não depois.
  const problemaDaQuantidade = itens.length ? recusaDaQuantidade(forma, itens.length) : null;

  function trocarForma(nova: FormaDePublicacao) {
    setForma(nova);
    // TROCAR A FORMA DESCARTA O ARQUIVO, e é honesto: as regras são outras (um
    // vídeo de 90 s serve para reels e não serve para story), e um arquivo já
    // enviado sob a regra antiga viraria um post que a Meta recusa depois de
    // tudo pronto. O objeto fica no bucket como órfão de upload abandonado —
    // que é o caso já registrado como aberto no plano, depois da Tarefa 4.
    setItens([]);
    limparEnvios();
    if (campoDeArquivo.current) campoDeArquivo.current.value = "";
  }

  async function aoEscolherArquivo(ev: React.ChangeEvent<HTMLInputElement>) {
    const escolhidos = Array.from(ev.target.files ?? []);
    if (!escolhidos.length) return;

    setItens([]);
    // O RÓTULO NASCE ANTES DO PRIMEIRO BYTE, e ele é a IDENTIDADE do arquivo no
    // depósito de envios (`atualizarEnvio` acha a linha pelo nome). No carrossel
    // ele leva a posição — ver `rotuloDoEnvio`: duas fotos exportadas como
    // "arte.jpg" da mesma pasta são um caso comum, e sem a posição as duas
    // seriam a mesma linha, com as duas barras andando juntas.
    const rotulos = escolhidos.map((a, i) => rotuloDoEnvio(a.name, i, escolhidos.length));
    definirEnvios(
      escolhidos.map((a, i) => ({
        nome: rotulos[i],
        estado: "escolhido" as const,
        enviados: 0,
        total: a.size,
      }))
    );

    // UM DE CADA VEZ, E NA ORDEM ESCOLHIDA. Não é economia de rede: a ordem do
    // carrossel é conteúdo (todos os itens são cortados pela proporção do
    // primeiro), e dez uploads em paralelo terminariam em ordem de tamanho, não
    // na ordem que a pessoa escolheu. Sequencial, a lista sai como ela montou —
    // e ainda dá para mudá-la nos botões abaixo.
    for (let i = 0; i < escolhidos.length; i++) {
      try {
        const caminho = await prepararEEnviar(escolhidos[i], rotulos[i], forma, teto);
        // CADA ARQUIVO ENTRA NA LISTA ASSIM QUE SOBE, e não todos no fim: um
        // carrossel de dez leva minutos, e uma lista que só aparece no fim
        // deixa quem está olhando sem saber o que já foi.
        if (caminho) setItens((atuais) => [...atuais, { caminho, rotulo: rotulos[i] }]);
      } catch (erro) {
        // O ENVIO QUE NÃO FOI NÃO PODE SUMIR CALADO. É a doença que o conserto
        // de 02/09 curou nas cinco ações, e ela entraria aqui por uma promessa
        // rejeitada sem `catch`.
        //
        // E O LAÇO NÃO PARA: um arquivo recusado no meio de dez não é motivo
        // para descartar os outros nove. Quem decide se o conjunto serve é a
        // contagem logo acima, e a ação de servidor depois dela.
        atualizarEnvio(rotulos[i], { estado: "falhou", detalhe: mensagemDoErro(erro) });
      }
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className={label} htmlFor="forma">
          Forma
        </label>
        <select
          id="forma"
          name="forma"
          className={input}
          value={forma}
          onChange={(e) => trocarForma(e.target.value as FormaDePublicacao)}
        >
          <option value="imagem">Imagem no feed</option>
          <option value="carrossel">Carrossel</option>
          <option value="reels">Reels</option>
          <option value="story">Story</option>
        </select>
        {/* AS DUAS REGRAS DO CARROSSEL APARECEM ANTES DE ESCOLHER OS ARQUIVOS, e
            a especificação (§6) manda que seja assim: a ordem importa, e
            descobri-la pelo resultado publicado é tarde — no perfil público não
            há `DELETE` que desfaça (medido em 03/09).

            Elas ficam visíveis SEMPRE, e não só com o carrossel escolhido: quem
            está decidindo entre reels e carrossel precisa saber que os dois não
            são a mesma coisa ANTES de escolher, e é justamente aí que a lista
            ainda está fechada. */}
        <p className={hint}>
          No carrossel valem duas regras da Meta: reels não entra (vídeo em
          carrossel é vídeo comum, sem áudio nomeado e sem aparecer no feed como
          reels), e todos os itens são cortados pela proporção do PRIMEIRO — por
          isso a ordem importa, e dá para mudá-la depois de enviar. São de 2 a{" "}
          {CARROSSEL_ITENS_MAX} itens, e o post inteiro conta como uma só
          publicação.
        </p>
      </div>

      <div>
        <label className={label} htmlFor="arquivo">
          {forma === "carrossel" ? "Arquivos" : "Arquivo"}
        </label>
        <input
          id="arquivo"
          ref={campoDeArquivo}
          type="file"
          // O CAMPO NÃO TEM `name`, e isso é o desenho inteiro: o arquivo NÃO
          // vai no formulário. Ele já subiu direto ao bucket, e o que a ação
          // recebe é o caminho dele — ver o cabeçalho deste arquivo.
          accept={tiposQueOCampoAceita(forma)}
          // `multiple` SÓ NO CARROSSEL, e é a única forma que publica mais de um
          // arquivo. Nas outras, escolher dois publicaria o primeiro e
          // descartaria o segundo — recusa que `recusaDaQuantidade` passou a
          // fazer no servidor, e que este atributo evita ANTES.
          multiple={forma === "carrossel"}
          onChange={aoEscolherArquivo}
          className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-200"
        />
        <p className={hint}>
          {/* O TETO DO BUCKET VEM DA ROTA, E NUNCA CRAVADO: ele está em 50 MB
              hoje só porque o pagamento do plano atrasou, e sobe sozinho quando
              entrar. Ver `tetoDoBucket` (lib/bucket.ts). */}
          {teto === null
            ? "O limite de tamanho do nosso armazenamento não pôde ser lido agora — o servidor confere no envio."
            : `Até ${Math.floor(teto / (1024 * 1024))} MB por arquivo no nosso armazenamento, além dos limites do próprio Instagram.`}
        </p>
      </div>

      {/* A ORDEM DO CARROSSEL, EDITÁVEL — e ela é a razão desta lista existir.
          Todos os itens são cortados pela proporção do PRIMEIRO, então trocar
          quem está em primeiro reenquadra o post inteiro. Quem decide a lista
          nova é `moverNaOrdem` (lib/publicacao.ts), que é pura e tem teste; o
          que mora aqui é o botão. */}
      {itens.length > 0 && (
        <div className={`${card} space-y-2 p-4`}>
          <p className={`text-xs font-medium ${muted}`}>
            {itens.length === 1
              ? "1 arquivo pronto para publicar."
              : `${itens.length} arquivos prontos, nesta ordem. O primeiro decide o enquadramento de todos.`}
          </p>
          <ol className="space-y-1">
            {itens.map((item, i) => (
              <li key={item.caminho} className="flex items-center gap-2 text-xs">
                <span className="tabular-nums text-zinc-500">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                  {item.rotulo}
                </span>
                {/* `type="button"` NÃO É DETALHE: sem ele, o padrão do HTML é
                    `submit`, e reordenar o carrossel PUBLICARIA o post. */}
                <button
                  type="button"
                  aria-label={`Subir ${item.rotulo}`}
                  disabled={i === 0}
                  onClick={() => setItens(moverNaOrdem(itens, i, i - 1))}
                  className="rounded px-2 py-0.5 text-zinc-600 enabled:hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-300 dark:enabled:hover:bg-zinc-800"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Descer ${item.rotulo}`}
                  disabled={i === itens.length - 1}
                  onClick={() => setItens(moverNaOrdem(itens, i, i + 1))}
                  className="rounded px-2 py-0.5 text-zinc-600 enabled:hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-300 dark:enabled:hover:bg-zinc-800"
                >
                  ↓
                </button>
              </li>
            ))}
          </ol>
          {/* A MESMA FRASE QUE A AÇÃO USARIA AO RECUSAR, e pelo mesmo motivo da
              legenda: duas redações do mesmo "não" fazem quem lê achar que são
              dois problemas. Ela AVISA — quem recusa é o servidor. */}
          {problemaDaQuantidade && (
            <p className={fieldError}>{textoDaRecusaDaPublicacao(problemaDaQuantidade)}</p>
          )}
        </div>
      )}

      <div>
        <label className={label} htmlFor="legenda">
          Legenda
        </label>
        <textarea
          id="legenda"
          name="legenda"
          rows={5}
          value={legenda}
          onChange={(e) => setLegenda(e.target.value)}
          className={input}
          placeholder="O texto que aparece embaixo do post."
        />
        <div className="mt-1.5 flex items-start justify-between gap-3">
          {/* A FRASE DO PROBLEMA VEM DE `textoDoProblemaDaLegenda`, e é a MESMA
              que a ação usa ao recusar. Duas redações do mesmo "não" fariam
              quem lê achar que são dois problemas.

              E ESTA CONTAGEM NÃO É A BARREIRA: quem recusa de verdade é a ação
              de servidor, com `redirect` e aviso. O que ela faz é avisar
              enquanto ainda dá para consertar — por isso o botão continua
              clicável, e a recusa continua sendo do servidor. */}
          <p className={problemaDaLegendaAtual ? fieldError : hint}>
            {problemaDaLegendaAtual
              ? textoDoProblemaDaLegenda(problemaDaLegendaAtual)
              : "Hashtags e menções contam: 30 e 20 são os limites do Instagram."}
          </p>
          <p className={`shrink-0 text-xs tabular-nums ${muted}`}>{legenda.length}/2200</p>
        </div>
      </div>

      {/* OS DOIS CAMPOS QUE A AÇÃO LÊ E O USUÁRIO NÃO VÊ.

          `caminhos` é o que decide QUAL objeto do bucket vira post — e ele é do
          navegador, ou seja do usuário. Quem confere que ele está dentro da
          pasta da conta do cookie é `caminhosDoCampo` (lib/publicacao.ts), no
          servidor. */}
      <input
        type="hidden"
        name="caminhos"
        value={itens.map((i) => i.caminho).join("\n")}
      />
      <input ref={campoDeFuso} type="hidden" name="fuso" defaultValue="" />

      {/* A LISTA DENTRO DA TELA, além da janelinha do canto: quem está olhando
          o formulário não deveria precisar procurar o canto da janela para
          saber se o arquivo subiu. As duas leem o MESMO depósito e a MESMA
          função pura, então elas não podem discordar. */}
      {envios.length > 0 && (
        <div className={`${card} p-4`}>
          <ul className="space-y-1">
            {resumoDoProgresso(envios)?.linhas.map((linha, i) => (
              <li key={i} className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {linha}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// A FIAÇÃO — daqui para baixo não há decisão de negócio nenhuma
// =============================================================================

/**
 * Do arquivo escolhido ao caminho no bucket. Devolve o caminho, ou `null`
 * quando o arquivo foi recusado (e o motivo já foi escrito no depósito).
 *
 * O RÓTULO É A IDENTIDADE NA TELA, e vem de fora porque quem sabe quantos
 * arquivos há é quem chama: no carrossel ele leva a posição
 * (`rotuloDoEnvio`), que é o que separa dois "arte.jpg" e o que mostra a ordem
 * enquanto tudo sobe.
 *
 * E ELE CARREGA O NOME ORIGINAL do começo ao fim, mesmo quando o arquivo é
 * convertido: quem escolheu "arte.png" não sabe o que é
 * `nomeDepoisDaConversao`, e ver "arte.jpg" no meio do envio pareceria outro
 * arquivo. O nome novo vai só para o bucket, que é onde ele importa.
 */
async function prepararEEnviar(
  escolhido: File,
  nome: string,
  forma: FormaDePublicacao,
  teto: number | null
): Promise<string | null> {
  let medidas = await medir(escolhido);

  const plano = planoDaConversao({
    mime: escolhido.type,
    largura: medidas.largura,
    altura: medidas.altura,
  });

  let arquivo = escolhido;
  if (plano.converter) {
    atualizarEnvio(nome, { estado: "convertendo" });
    arquivo = await converterParaJpeg(escolhido, plano);
    // AS MEDIDAS MUDAM COM A CONVERSÃO. Validar o arquivo NOVO com as dimensões
    // do ANTIGO recusaria uma arte de 3000px que acabou de virar 1440 — e a
    // recusa seria por um número que já não existe.
    if (plano.largura > 0) medidas = { ...medidas, largura: plano.largura, altura: plano.altura };
  }

  const declarado = {
    mime: arquivo.type,
    bytes: arquivo.size,
    segundos: medidas.segundos,
    largura: medidas.largura,
    altura: medidas.altura,
  };

  // A PRIMEIRA DAS DUAS BARREIRAS. Esta existe para dar mensagem boa e não
  // gastar o upload; a segunda é a rota que assina, e ela existe porque o
  // navegador é do usuário. É a MESMA função nos dois lados, de propósito.
  const problema = problemaDoArquivo(
    forma,
    declarado,
    // TETO DESCONHECIDO NÃO É TETO ZERO nem um número inventado: sem saber o
    // nosso limite, o que resta é o da Meta — e quem diz "não" com certeza é o
    // servidor, que pergunta ao bucket antes de assinar.
    teto ?? Number.POSITIVE_INFINITY
  );
  if (problema) {
    atualizarEnvio(nome, { estado: "recusado", detalhe: textoDoProblema(problema) });
    return null;
  }

  atualizarEnvio(nome, { estado: "assinando", enviados: 0, total: arquivo.size });
  const resposta = await fetch("/api/midia/assinar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ forma, nome: arquivo.name, ...declarado }),
  });
  const dados = (await resposta.json().catch(() => null)) as
    | { caminho?: string; url?: string; error?: string }
    | null;

  if (!resposta.ok || !dados?.url || !dados?.caminho) {
    // A FRASE DO SERVIDOR PASSA INTEIRA. Ela veio de `textoDoProblema` do outro
    // lado, então é a mesma redação — reescrevê-la aqui criaria a segunda.
    atualizarEnvio(nome, {
      estado: "recusado",
      detalhe: dados?.error ?? "O servidor não liberou o envio.",
    });
    return null;
  }

  atualizarEnvio(nome, { estado: "enviando", enviados: 0, total: arquivo.size });
  await subirComProgresso(dados.url, arquivo, (enviados, total) =>
    atualizarEnvio(nome, { enviados, total })
  );

  atualizarEnvio(nome, { estado: "pronto", enviados: arquivo.size, total: arquivo.size });
  return dados.caminho;
}

/** As medidas do arquivo, quando o navegador as entrega. */
type Medidas = { largura?: number; altura?: number; segundos?: number };

/**
 * Mede o arquivo sem enviá-lo.
 *
 * MEDIR PODE FALHAR, E FALHAR NÃO É RECUSAR: um codec que este navegador não
 * abre ainda pode ser um MP4 que a Meta aceita. `problemaDoArquivo` trata
 * medida ausente como "não sei" e não como "não serve" (está escrito no tipo
 * `ArquivoDeclarado`), então o caminho certo aqui é devolver o que se
 * conseguiu, e nada mais.
 *
 * ZERO VIRA AUSENTE. `videoWidth` é 0 enquanto os metadados não carregaram, e
 * um zero atravessando daqui viraria "estreito_demais" — uma recusa por uma
 * medição que não aconteceu.
 */
async function medir(arquivo: File): Promise<Medidas> {
  const endereco = URL.createObjectURL(arquivo);
  try {
    if (arquivo.type.startsWith("video/")) return await medirVideo(endereco);
    if (arquivo.type.startsWith("image/")) return await medirImagem(endereco);
    return {};
  } catch {
    return {};
  } finally {
    URL.revokeObjectURL(endereco);
  }
}

function numeroOuNada(n: number): number | undefined {
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function medirImagem(endereco: string): Promise<Medidas> {
  return new Promise((ok, nao) => {
    const img = new Image();
    img.onload = () =>
      ok({ largura: numeroOuNada(img.naturalWidth), altura: numeroOuNada(img.naturalHeight) });
    img.onerror = () => nao(new Error("Não foi possível ler a imagem."));
    img.src = endereco;
  });
}

function medirVideo(endereco: string): Promise<Medidas> {
  return new Promise((ok, nao) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      ok({
        largura: numeroOuNada(video.videoWidth),
        altura: numeroOuNada(video.videoHeight),
        segundos: numeroOuNada(video.duration),
      });
    video.onerror = () => nao(new Error("Não foi possível ler o vídeo."));
    video.src = endereco;
  });
}

/**
 * Redesenha a imagem como JPEG, no tamanho que `planoDaConversao` mandou.
 *
 * =============================================================================
 * O `fillRect` BRANCO NÃO É ENFEITE — É A ARMADILHA Nº 1 DESTA CONVERSÃO
 *
 * O `canvas` nasce TRANSPARENTE, e o JPEG não tem canal alfa. Um PNG com fundo
 * transparente desenhado direto vira um JPEG de fundo PRETO: a arte com respiro
 * branco ao redor sai com moldura preta, e sai no perfil público, onde não há
 * `DELETE` que a tire (medido em 03/09). Pintar antes do `drawImage` é o que
 * troca o preto pelo branco que quem exportou o PNG esperava ver.
 *
 * O `canvas` também RE-COMPRIME, e por isso `planoDaConversao` só manda
 * converter quando há motivo — ver o cabeçalho dela, e `QUALIDADE_DO_JPEG` para
 * o porquê do 0,9.
 */
async function converterParaJpeg(
  arquivo: File,
  plano: { largura: number; altura: number; qualidade: number }
): Promise<File> {
  const bitmap = await createImageBitmap(arquivo);
  try {
    // PLANO SEM MEDIDA USA A DA IMAGEM. `planoDaConversao` devolve 0/0 quando o
    // navegador ainda não sabia o tamanho, e cravar zero aqui gravaria um
    // arquivo de zero pixel — está escrito no cabeçalho dela.
    const largura = plano.largura > 0 ? plano.largura : bitmap.width;
    const altura = plano.altura > 0 ? plano.altura : bitmap.height;

    const tela = document.createElement("canvas");
    tela.width = largura;
    tela.height = altura;
    const pincel = tela.getContext("2d");
    if (!pincel) throw new Error("Este navegador não permitiu preparar a imagem.");

    pincel.fillStyle = "#ffffff";
    pincel.fillRect(0, 0, largura, altura);
    pincel.drawImage(bitmap, 0, 0, largura, altura);

    const blob = await new Promise<Blob | null>((resolver) =>
      tela.toBlob(resolver, "image/jpeg", plano.qualidade)
    );
    if (!blob) throw new Error("Não foi possível preparar a imagem para envio.");

    // O NOME NOVO VAI PARA O BUCKET: `caminhoDoObjeto` (lib/bucket.ts) lê a
    // EXTENSÃO para nomear o objeto, e um ".png" ali viraria um objeto ".bin".
    return new File([blob], nomeDepoisDaConversao(arquivo.name), { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

/**
 * O `PUT` na URL assinada, com progresso.
 *
 * É `XMLHttpRequest` PORQUE `fetch` NÃO DÁ PROGRESSO DE UPLOAD. A API expõe o
 * corpo que DESCE (`response.body`), não o que sobe; não há opção, e por isso
 * esta é a única `XMLHttpRequest` do projeto.
 *
 * SEM CABEÇALHO DE AUTENTICAÇÃO, e isso foi MEDIDO em 03/09: o `?token=` da URL
 * é a credencial inteira, vale só para aquele caminho, só para subir, e por 2
 * horas. É o que fecha o desenho — a `SUPABASE_SERVICE_ROLE_KEY` nunca sai do
 * servidor, e o navegador recebe permissão de um arquivo só.
 */
function subirComProgresso(
  endereco: string,
  arquivo: File,
  aoAndar: (enviados: number, total: number) => void
): Promise<void> {
  return new Promise((ok, nao) => {
    const pedido = new XMLHttpRequest();
    pedido.open("PUT", endereco, true);
    pedido.setRequestHeader("Content-Type", arquivo.type || "application/octet-stream");

    pedido.upload.onprogress = (ev) => {
      // `lengthComputable` FALSO É O CASO EM QUE NÃO SE SABE O TOTAL, e
      // `porcentagemDoEnvio` já trata total zero sem virar NaN. Não vale
      // inventar um total aqui.
      if (ev.lengthComputable) aoAndar(ev.loaded, ev.total);
    };
    pedido.onload = () =>
      pedido.status >= 200 && pedido.status < 300
        ? ok()
        : nao(new Error(`O armazenamento recusou o arquivo (HTTP ${pedido.status}).`));
    pedido.onerror = () => nao(new Error("A conexão caiu durante o envio."));
    pedido.onabort = () => nao(new Error("O envio foi interrompido."));

    pedido.send(arquivo);
  });
}

/** A mensagem de um erro que veio de qualquer lugar. Nada de "[object Object]"
 *  na tela — e nada de despejar o objeto inteiro, que pode carregar a URL
 *  assinada com o token dentro. */
function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error && erro.message ? erro.message : "O envio não foi.";
}
