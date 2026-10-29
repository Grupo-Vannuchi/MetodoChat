"use client";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import {
  PROPORCOES_DO_POST,
  PROPORCAO_PADRAO,
  acrescentarNaLista,
  caixaDaMiniatura,
  camposDaDataHora,
  campoAceitaVariosArquivos,
  fusoDoCampo,
  geometriaDoEnquadramento,
  instanteDoAgendamento,
  momentoDaPublicacao,
  moverNaOrdem,
  planoDaConversao,
  problemaDaLegenda,
  problemaDaSaida,
  problemaDoArquivo,
  problemaDoPrimeiroSlide,
  resumoDoProgresso,
  rotuloDaForma,
  rotuloDoEnvio,
  tetoParaAConferenciaDaTela,
  textoDaContagem,
  textoDaQuantidadeNaTela,
  textoDaRecusaDaPublicacao,
  textoDaRecusaDaTela,
  textoDoEnvioQueNaoFoi,
  textoDoProblema,
  textoDoProblemaDaLegenda,
  textoDoProblemaDaSaida,
  textoDoProblemaDoPrimeiroSlide,
  tiposQueOCampoAceita,
  vaiSemRedesenho,
  CARROSSEL_ITENS_MAX,
  type EnvioEmAndamento,
  type FormaDePublicacao,
  type ModoDoEnquadramento,
  type ProblemaDaSaida,
  type ProporcaoDoPost,
} from "@/lib/publicacao";
import { assinarEnvios, atualizarEnvio, definirEnvios, lerEnvios, lerEnviosNoServidor, limparEnvios } from "./envios";
import { navegadorDeVerdade, type Medidas, type Navegador } from "./navegador";
import { btnPrimary, card, fieldError, hint, input, label, muted, numero } from "../ui";

// O COMPOSITOR DO /publicar — o formulário inteiro, e a exceção declarada na
// especificação (§3): o navegador é quem envia o arquivo, porque a Vercel recusa
// corpo acima de 4,5 MB (medido) e um reels vai a 300 MB.
//
// =============================================================================
// O ARQUIVO SOBE NO CLIQUE DE PUBLICAR (spec 2026-10-19-enquadrar-imagens)
//
// Antes ele subia ao ser escolhido, e o caminho já pronto antes do botão era a
// defesa contra o clique duplo: dois cliques mandavam os mesmos caminhos, e a
// dedupe os fazia um item só (lib/dedupe.ts). Agora a pessoa escolhe a
// proporção, o modo de cada imagem, remove e reordena DEPOIS de escolher, e só
// o clique sobe. O caminho nasce dentro do clique, e um segundo clique subiria
// tudo de novo, com outros caminhos e outra chave: dois posts no perfil, sem
// `DELETE` (achado 107). Por isso:
//
//   - O BOTÃO É `type="button"` E TRAVA NUMA REFERÊNCIA ligada antes de
//     qualquer espera, no molde do gerador (card-publicar.tsx). O estado da tela
//     não serve de trava: ele só muda no próximo render, e dois cliques no mesmo
//     quadro passariam os dois.
//   - O FORMULÁRIO NÃO TEM `action`. Hoje o Enter não o envia: não há botão de
//     `submit`, e a data e o nome do áudio são campos que bloqueiam o envio
//     implícito. Ainda assim, um envio nativo leva `preventDefault` aqui mesmo e
//     cai no mesmo caminho, sob a mesma trava: a action só é chamada por
//     `publicar`, venha o envio de onde vier.
//   - O FORMULÁRIO É LIDO NO CLIQUE, antes de qualquer espera (achado 115).
//     Durante a subida a tela trava os campos com `disabled`, e campo
//     desabilitado não entra no `FormData`: lido depois da subida, o post saía
//     sem legenda, calado, nas quatro formas.
//   - A ACTION RECEBE ESSE `FormData`, com os caminhos de uma variável, e não de
//     um campo controlado pelo estado: um estado atualizado depois de uma espera
//     ainda não chegou ao campo (achado 108).
//
// =============================================================================
// A SUBIDA FICA FORA DA TRANSIÇÃO (achado 116)
//
// Uma transição assíncrona aberta prende as seguintes: o React junta toda
// transição nova à que está em curso, e o `Link` do menu navega por
// `startTransition`. Com a subida dentro da transição, o clique no menu ficaria
// parado até a subida e a action acabarem (minutos num reels), e a action seria
// chamada de uma tela que ninguém está vendo. Isso foi LIDO no React embutido no
// Next, e não medido; o conserto vale nos dois casos. A subida corre fora, com um
// estado `enviando` próprio, que trava a tela e liga o `beforeunload`. Dentro da
// transição fica só a espera da action, que é o que a sonda abaixo mediu.
//
// CADA LEVA TEM UM `AbortController`, criado antes da primeira espera. Sair da
// tela o aborta: o pedido da assinatura e a subida param, e depois de cada
// espera a leva confere o sinal antes de seguir.
//
// =============================================================================
// A ACTION TERMINA EM `redirect`, E ISSO FOI MEDIDO
//
// Uma sonda de laboratório mediu em 19/10/2026, no Next 16.3.8 (`next dev` e
// `next build` + `next start`), uma action chamada assim dentro de
// `startTransition`, com redirect para a própria rota: o componente é RECRIADO,
// a espera REJEITA com `NEXT_REDIRECT`, o `finally` roda e o `isPending` volta a
// falso. Então a chamada da action NÃO TEM `catch`: um `catch` trataria o
// `NEXT_REDIRECT` de um sucesso como falha. Só `try`/`finally`, e o `finally`
// solta a trava. tests/publicar-compositor-guarda.test.ts cobra isso.
//
// =============================================================================
// NENHUMA DECISÃO MORA AQUI
//
// O retângulo do corte, se o arquivo vai cru, o vermelho da lista, a trava do
// primeiro slide, a caixa da miniatura, a quantidade, a legenda, a hora e as
// frases do clique vêm de `lib/publicacao.ts`, puros e com caso. O que sobra
// aqui é fiação e desenho, e a fiação do navegador está em `./navegador.ts`.

/** Um arquivo escolhido, e o que a tela sabe dele. */
type Slide = {
  id: string;
  arquivo: File;
  /** O endereço local para a miniatura (`navegador.criarEndereco`). */
  endereco: string;
  video: boolean;
  /** `null` enquanto o navegador ainda mede. */
  medidas: Medidas | null;
  /** A orientação EXIF; 0 até ser lida, e quando não deu para ler. */
  orientacao: number;
  modo: ModoDoEnquadramento;
  /** O caminho no bucket, SÓ depois do 2xx da subida, e para qual conta, forma, proporção e modo ele foi feito. */
  enviado: { caminho: string; chave: string } | null;
};

export default function Enviador({
  teto,
  pasta,
  acao,
  quando,
  opcoesDoReels,
  rodape,
  navegador = navegadorDeVerdade,
}: {
  teto: number | null;
  /** A pasta da conta no bucket (`pastaDaConta`): os caminhos têm de estar nela antes de chamar a action. */
  pasta: string;
  acao: (dados: FormData) => Promise<void>;
  /** As partes do formulário que são de servidor, e vêm prontas da página. */
  quando: ReactNode;
  opcoesDoReels: ReactNode;
  rodape: ReactNode;
  navegador?: Navegador;
}) {
  const [forma, setForma] = useState<FormaDePublicacao>("imagem");
  const [proporcao, setProporcao] = useState<ProporcaoDoPost>(PROPORCAO_PADRAO);
  const [legenda, setLegenda] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [foraDaLista, setForaDaLista] = useState(0);
  const [recusa, setRecusa] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pendente, iniciar] = useTransition();
  /** A tela travada: subindo os arquivos, ou esperando a action. */
  const ocupado = enviando || pendente;
  const formulario = useRef<HTMLFormElement>(null);
  const campoDeArquivo = useRef<HTMLInputElement>(null);
  const trava = useRef(false);
  /** O controle da leva em curso, e `null` fora dela. */
  const leva = useRef<AbortController | null>(null);
  const proximoId = useRef(0);
  const enderecos = useRef(new Set<string>());
  const envios = useSyncExternalStore(assinarEnvios, lerEnvios, lerEnviosNoServidor);

  // A JANELINHA NÃO ATRAVESSA UM PEDIDO NOVO: o depósito é um módulo e sobrevive
  // ao `redirect`, e o envio ENCERRADO do pedido anterior ficaria no canto.
  useEffect(() => {
    if (resumoDoProgresso(lerEnvios())?.encerrado) limparEnvios();
  }, []);

  // SAIR DA TELA NO MEIO DA SUBIDA INTERROMPE. Antes o laço e o `XMLHttpRequest`
  // sobreviviam à desmontagem, e agora a action vem DEPOIS deles: ela seria
  // chamada de uma tela que ninguém está vendo. A janelinha diz que a
  // publicação não foi pedida, e os endereços das miniaturas são soltos.
  useEffect(() => {
    const locais = enderecos.current;
    return () => {
      const emCurso = leva.current;
      if (emCurso) {
        emCurso.abort();
        definirEnvios(
          lerEnvios().map((e) =>
            e.estado === "pronto" || e.estado === "recusado" || e.estado === "falhou"
              ? e
              : { ...e, estado: "falhou", detalhe: "A publicação não foi pedida." }
          )
        );
      }
      for (const endereco of locais) navegador.soltarEndereco(endereco);
      locais.clear();
    };
  }, [navegador]);

  // FECHAR OU RECARREGAR A ABA NO MEIO DA SUBIDA pede confirmação: o que já subiu
  // ficaria órfão no bucket, e o post não seria pedido.
  useEffect(() => {
    if (!ocupado) return;
    const segurar = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("beforeunload", segurar);
    return () => window.removeEventListener("beforeunload", segurar);
  }, [ocupado]);

  const enquadra = forma === "imagem" || forma === "carrossel";
  const tetoDaTela = tetoParaAConferenciaDaTela(teto);
  const linhas = slides.map((s) => ({
    s,
    medindo: s.medidas === null,
    problema:
      s.medidas === null
        ? null
        : problemaDaSaida(
            forma,
            { mime: s.arquivo.type, bytes: s.arquivo.size, ...s.medidas, orientacao: s.orientacao },
            proporcao,
            s.modo,
            tetoDaTela
          ),
  }));
  const algumMedindo = linhas.some((l) => l.medindo);
  const validos = linhas.filter((l) => !l.medindo && !l.problema).map((l) => l.s);
  const medidos = linhas
    .filter((l) => !l.medindo)
    .map((l) => ({ video: l.s.video, largura: l.s.medidas?.largura, altura: l.s.medidas?.altura, valido: !l.problema }));
  // A QUANTIDADE SÓ É DITA COM TUDO MEDIDO: um arquivo ainda em leitura não é
  // válido nem vermelho, e contá-lo como "não serve" seria mentir por um instante.
  const quantidadeNaTela = slides.length && !algumMedindo ? textoDaQuantidadeNaTela(forma, slides.length, validos.length) : null;
  const primeiroSlide = forma === "carrossel" ? problemaDoPrimeiroSlide(medidos, proporcao) : null;
  // A LEGENDA É CONFERIDA COMO A ACTION A CONFERE: sem os espaços das pontas.
  const problemaDaLegendaAtual = problemaDaLegenda(legenda.trim());
  const caixa = caixaDaMiniatura(forma, medidos, proporcao);

  function soltar(lista: Slide[]) {
    for (const s of lista) {
      navegador.soltarEndereco(s.endereco);
      enderecos.current.delete(s.endereco);
    }
  }

  function trocarForma(nova: FormaDePublicacao) {
    // TROCAR A FORMA DESCARTA A LISTA, porque as regras são outras (um vídeo de
    // 90 s serve para reels e não para story). Antes, isso deixava no bucket
    // tudo o que já tinha subido, e era o caminho mais barato do órfão (o
    // Vinícius registrou em aberto). Agora nada subiu antes do clique, e nada
    // fica.
    setForma(nova);
    soltar(slides);
    setSlides([]);
    setForaDaLista(0);
    setRecusa(null);
    limparEnvios();
    if (campoDeArquivo.current) campoDeArquivo.current.value = "";
  }

  async function aoEscolherArquivo(ev: React.ChangeEvent<HTMLInputElement>) {
    const escolhidos = Array.from(ev.target.files ?? []);
    // O CAMPO VOLTA A VAZIO para escolher o mesmo arquivo de novo disparar a troca.
    ev.target.value = "";
    if (!escolhidos.length) return;
    setRecusa(null);
    const novos: Slide[] = escolhidos.map((arquivo) => {
      const endereco = navegador.criarEndereco(arquivo);
      enderecos.current.add(endereco);
      return {
        id: `s${proximoId.current++}`,
        arquivo,
        endereco,
        video: arquivo.type.startsWith("video/"),
        medidas: null,
        orientacao: 0,
        modo: "cortar",
        enviado: null,
      };
    });
    // QUEM FICA NA LISTA é decidido sobre a lista que a pessoa vê, mas os dados
    // de cada slide vêm do estado mais novo: uma medida que chegou entre o último
    // desenho e esta escolha não se perde (o slide ficaria em "Lendo o arquivo…").
    const { lista, deFora } = acrescentarNaLista(slides, novos, forma);
    const ficam = new Set(lista.map((s) => s.id));
    soltar([...slides, ...novos].filter((s) => !ficam.has(s.id)));
    setSlides((atuais) => {
      const porId = new Map(atuais.map((s) => [s.id, s]));
      return lista.map((s) => porId.get(s.id) ?? s);
    });
    setForaDaLista(deFora);
    // A MEDIDA DE CADA UM, sem segurar a tela: a linha diz "Lendo o arquivo…"
    // até ela chegar.
    for (const s of novos.filter((n) => ficam.has(n.id))) {
      const [medidas, orientacao] = await Promise.all([navegador.medir(s.arquivo), navegador.lerOrientacao(s.arquivo)]);
      setSlides((atuais) => atuais.map((x) => (x.id === s.id ? { ...x, medidas, orientacao } : x)));
    }
  }

  function remover(id: string) {
    soltar(slides.filter((s) => s.id === id));
    setSlides((atuais) => atuais.filter((s) => s.id !== id));
    // O AVISO DE QUEM FICOU DE FORA SAI JUNTO: com um slide a menos, ele já não
    // diz a verdade.
    setForaDaLista(0);
  }

  function mudarModo(id: string, modo: ModoDoEnquadramento) {
    setSlides((atuais) => atuais.map((s) => (s.id === id ? { ...s, modo } : s)));
  }

  /**
   * Para que conta, forma, proporção e modo o caminho guardado vale: mudar
   * qualquer um sobe de novo. A CONTA ENTRA porque a troca no seletor entre uma
   * tentativa que falhou e a próxima deixaria guardado um caminho da pasta
   * antiga, e o clique seguinte recusaria com "a conta mudou" sem envio nenhum em
   * andamento.
   */
  function chaveDe(s: Slide): string {
    return `${pasta}|${forma}|${proporcao}|${s.modo}`;
  }

  /** A recusa da hora, pelas mesmas funções da action, sobre o formulário lido no clique. `null` quando ela serve. */
  function recusaDaHora(dados: FormData): string | null {
    const campos = camposDaDataHora(dados.get("data_hora"));
    const momento = momentoDaPublicacao(
      dados.get("quando"),
      campos ? instanteDoAgendamento(campos, fusoDoCampo(dados.get("fuso"))) : null,
      Date.now()
    );
    return momento.ok ? null : textoDaRecusaDaPublicacao(momento.motivo);
  }

  /** Prepara e sobe um slide. Devolve o caminho, ou `null` com o motivo já escrito na janelinha. */
  async function prepararESubir(s: Slide, nome: string, sinal: AbortSignal): Promise<string | null> {
    try {
      let arquivo = s.arquivo;
      let medidas: Medidas = s.medidas ?? {};
      const ehImagem = arquivo.type.startsWith("image/");
      if (ehImagem && enquadra && medidas.largura && medidas.altura) {
        const cru = vaiSemRedesenho({
          mime: arquivo.type,
          largura: medidas.largura,
          altura: medidas.altura,
          bytes: arquivo.size,
          proporcao,
          orientacao: s.orientacao,
        });
        if (!cru) {
          const g = geometriaDoEnquadramento({ largura: medidas.largura, altura: medidas.altura, proporcao, modo: s.modo });
          if (!g.ok) {
            atualizarEnvio(nome, { estado: "recusado", detalhe: textoDoProblema("estreito_demais") });
            return null;
          }
          atualizarEnvio(nome, { estado: "convertendo" });
          arquivo = await navegador.enquadrar(s.arquivo, g);
          seguir(sinal);
          medidas = { largura: g.largura, altura: g.altura };
        }
      } else if (ehImagem && forma === "story") {
        const plano = planoDaConversao({ mime: arquivo.type, largura: medidas.largura, altura: medidas.altura });
        if (plano.converter) {
          atualizarEnvio(nome, { estado: "convertendo" });
          arquivo = await navegador.converter(s.arquivo, plano);
          seguir(sinal);
          if (plano.largura > 0) medidas = { largura: plano.largura, altura: plano.altura };
        }
      }

      const declarado = {
        mime: arquivo.type,
        bytes: arquivo.size,
        segundos: medidas.segundos,
        largura: medidas.largura,
        altura: medidas.altura,
      };
      // A ÚLTIMA CONFERÊNCIA DA TELA, sobre o arquivo que DE FATO sobe, com a
      // mesma função da rota que assina.
      const problema = problemaDoArquivo(forma, declarado, tetoDaTela);
      if (problema) {
        atualizarEnvio(nome, { estado: "recusado", detalhe: textoDoProblema(problema) });
        return null;
      }

      atualizarEnvio(nome, { estado: "assinando", enviados: 0, total: arquivo.size });
      const assinatura = await navegador.assinar({ forma, nome: arquivo.name, ...declarado }, sinal);
      seguir(sinal);
      if (!assinatura.ok) {
        atualizarEnvio(nome, { estado: "recusado", detalhe: assinatura.erro });
        return null;
      }

      atualizarEnvio(nome, { estado: "enviando", enviados: 0, total: arquivo.size });
      await navegador.subir(assinatura.url, arquivo, (enviados, total) => atualizarEnvio(nome, { enviados, total }), sinal);
      atualizarEnvio(nome, { estado: "pronto", enviados: arquivo.size, total: arquivo.size });
      return assinatura.caminho;
    } catch (erro) {
      // A LEVA INTERROMPIDA PELA SAÍDA DA TELA NÃO ESCREVE NADA: a limpeza já pôs
      // "A publicação não foi pedida." na janelinha, e "O envio foi
      // interrompido." por cima dela diria menos.
      if (sinal.aborted) return null;
      // O ENVIO QUE NÃO FOI NÃO PODE SUMIR CALADO. Este `catch` é da SUBIDA, e não
      // da action: a action é chamada fora daqui, sem `catch` (ver o cabeçalho).
      atualizarEnvio(nome, { estado: "falhou", detalhe: mensagemDoErro(erro) });
      return null;
    }
  }

  /** Sobe os válidos na ordem da lista. Os que já subiram para a mesma chave não sobem de novo. */
  async function subirTodos(lista: Slide[], sinal: AbortSignal): Promise<string[] | null> {
    const nomes = lista.map((s, i) => rotuloDoEnvio(s.arquivo.name, i, lista.length));
    const jaEnviado = (s: Slide) => (s.enviado && s.enviado.chave === chaveDe(s) ? s.enviado.caminho : null);
    definirEnvios(
      lista.map(
        (s, i): EnvioEmAndamento =>
          jaEnviado(s)
            ? { nome: nomes[i], estado: "pronto", enviados: s.arquivo.size, total: s.arquivo.size }
            : { nome: nomes[i], estado: "escolhido", enviados: 0, total: s.arquivo.size }
      )
    );
    const caminhos: string[] = [];
    for (let i = 0; i < lista.length; i++) {
      const guardado = jaEnviado(lista[i]);
      if (guardado) {
        caminhos.push(guardado);
        continue;
      }
      const caminho = await prepararESubir(lista[i], nomes[i], sinal);
      if (sinal.aborted) return null;
      if (!caminho) {
        setRecusa(textoDoEnvioQueNaoFoi(nomes[i]));
        return null;
      }
      // O CAMINHO SÓ É GUARDADO DEPOIS DO 2xx: `prepararESubir` só o devolve
      // depois de `subir` resolver.
      const chave = chaveDe(lista[i]);
      const id = lista[i].id;
      setSlides((atuais) => atuais.map((x) => (x.id === id ? { ...x, enviado: { caminho, chave } } : x)));
      caminhos.push(caminho);
    }
    return caminhos;
  }

  /**
   * AS CONFERÊNCIAS, A SUBIDA E O PEDIDO, fora da transição. Devolve o
   * `FormData` da action, ou `null` com o motivo já na tela.
   */
  async function montarOPedido(): Promise<FormData | null> {
    const form = formulario.current;
    if (!form) return null;
    // O FORMULÁRIO É LIDO AQUI, NO CLIQUE, antes de qualquer espera e antes de a
    // tela travar os campos (achado 115).
    const pedido = new FormData(form);
    // O FUSO TAMBÉM É O DO CLIQUE. Ele morava num campo escondido, escrito por um
    // efeito depois da hidratação, e o React devolvia o campo ao `defaultValue`
    // vazio a cada desenho: medido em 19/10 no compositor de produção, o campo ia
    // de "180" a vazio na primeira letra da legenda, e a action caía no fuso do
    // painel (`fusoDoCampo`). Quem agendava fora de Brasília via o post sair na
    // hora errada. Lido aqui, no navegador e no clique, ele não passa por desenho
    // nenhum, e o `datetime-local` continua com quem diga onde são as 14:30.
    pedido.set("fuso", String(new Date().getTimezoneOffset()));
    // AS CONFERÊNCIAS ANTES DE SUBIR, com as MESMAS funções da action (achado
    // 109): antes, todas chegavam depois da subida, porque o formulário não tem
    // `required`.
    if (algumMedindo) {
      setRecusa(textoDaRecusaDaTela("lendo_arquivos"));
      return null;
    }
    const quantidade = textoDaQuantidadeNaTela(forma, slides.length, validos.length);
    if (quantidade) {
      setRecusa(quantidade);
      return null;
    }
    if (primeiroSlide) {
      setRecusa(textoDoProblemaDoPrimeiroSlide(primeiroSlide));
      return null;
    }
    const daLegenda = problemaDaLegenda(String(pedido.get("legenda") ?? "").trim());
    if (daLegenda) {
      setRecusa(textoDoProblemaDaLegenda(daLegenda));
      return null;
    }
    const daHora = recusaDaHora(pedido);
    if (daHora) {
      setRecusa(daHora);
      return null;
    }

    const controle = new AbortController();
    leva.current = controle;
    setEnviando(true);
    try {
      const caminhos = await subirTodos(validos, controle.signal);
      if (!caminhos || controle.signal.aborted) return null;
      // TODOS NA PASTA DA CONTA DESTA TELA. A troca de conta no seletor no meio
      // da subida faria a action descartar calada o que é de outra pasta
      // (`caminhosDoCampo`) e publicar o resto.
      if (caminhos.some((c) => !c.startsWith(`${pasta}/`))) {
        setRecusa(textoDaRecusaDaTela("conta_mudou"));
        return null;
      }
      // A HORA DE NOVO: a subida pode levar minutos, e a tolerância do "agora"
      // é de 60 s.
      const daHoraDepois = recusaDaHora(pedido);
      if (daHoraDepois) {
        setRecusa(daHoraDepois);
        return null;
      }
      // A JANELINHA SAI ANTES DA ACTION: "Envios concluídos." não é
      // "publicado", e o desfecho é o aviso que a action devolve na tela.
      limparEnvios();
      pedido.set("forma", forma);
      pedido.set("caminhos", caminhos.join("\n"));
      return pedido;
    } finally {
      leva.current = null;
    }
  }

  /** Solta a trava e destrava a tela: a leva acabou sem pedido, ou a action respondeu. */
  function liberar() {
    trava.current = false;
    setEnviando(false);
  }

  async function publicar() {
    // A TRAVA, ligada antes de qualquer espera (achado 107).
    if (trava.current) return;
    trava.current = true;
    setRecusa(null);
    let pedido: FormData | null = null;
    try {
      pedido = await montarOPedido();
    } finally {
      // SEM PEDIDO (a recusa, a falha da subida ou a saída da tela), a trava
      // solta aqui; com ele, só depois da action.
      if (!pedido) liberar();
    }
    if (!pedido) return;
    const dados = pedido;
    // A ACTION, E SÓ ELA, DENTRO DA TRANSIÇÃO: é o que a sonda mediu.
    iniciar(async () => {
      try {
        await acao(dados);
      } finally {
        liberar();
      }
    });
  }

  return (
    <form
      ref={formulario}
      className={`${card} space-y-6 p-5`}
      onSubmit={(ev) => {
        ev.preventDefault();
        void publicar();
      }}
    >
      <div>
        <label className={label} htmlFor="forma">
          Forma
        </label>
        <select
          id="forma"
          name="forma"
          className={input}
          value={forma}
          disabled={ocupado}
          onChange={(e) => trocarForma(e.target.value as FormaDePublicacao)}
        >
          {/* AS PALAVRAS VÊM DE `rotuloDaForma` (lib/publicacao.ts): a tela de
              agendados usa as mesmas quatro. A ORDEM é desta tela. */}
          <option value="imagem">{rotuloDaForma("imagem")}</option>
          <option value="carrossel">{rotuloDaForma("carrossel")}</option>
          <option value="reels">{rotuloDaForma("reels")}</option>
          <option value="story">{rotuloDaForma("story")}</option>
        </select>
        <p className={hint}>
          No carrossel valem duas regras da Meta: reels não entra (vídeo em carrossel é vídeo comum, sem áudio
          nomeado e sem aparecer no feed como reels), e todos os itens são cortados pela proporção do PRIMEIRO
          — por isso a ordem importa, e dá para mudá-la na lista abaixo. São de 2 a {CARROSSEL_ITENS_MAX} itens,
          e o post inteiro conta como uma só publicação.
        </p>
      </div>

      {enquadra && (
        <fieldset className="space-y-2">
          <legend className={label}>Proporção</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {PROPORCOES_DO_POST.map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="proporcao"
                  value={p.id}
                  checked={proporcao === p.id}
                  disabled={ocupado}
                  onChange={() => setProporcao(p.id)}
                />
                {p.rotulo}
              </label>
            ))}
          </div>
          <p className={hint}>
            Cada imagem sai nesta proporção: cortada ao centro, ou inteira, com bordas brancas.
          </p>
        </fieldset>
      )}

      <div>
        <label className={label} htmlFor="arquivo">
          {forma === "carrossel" ? "Arquivos" : "Arquivo"}
        </label>
        <input
          id="arquivo"
          ref={campoDeArquivo}
          type="file"
          // O CAMPO NÃO TEM `name`: o arquivo não vai no formulário. Ele sobe no
          // clique, direto ao bucket, e a action recebe o caminho.
          accept={tiposQueOCampoAceita(forma)}
          multiple={campoAceitaVariosArquivos(forma)}
          disabled={ocupado}
          onChange={aoEscolherArquivo}
          className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-200"
        />
        <p className={hint}>
          {/* O TETO DO BUCKET VEM DA ROTA, E NUNCA CRAVADO (`tetoDoBucket`). */}
          {teto === null
            ? "O limite de tamanho do nosso armazenamento não pôde ser lido agora — o servidor confere no envio."
            : `Até ${Math.floor(teto / (1024 * 1024))} MB por arquivo no nosso armazenamento, além dos limites do próprio Instagram.`}
          {forma === "carrossel" ? " Escolher de novo acrescenta ao fim da lista." : ""}
        </p>
        {foraDaLista > 0 && (
          <p className={fieldError}>
            {foraDaLista === 1 ? "1 arquivo ficou de fora" : `${foraDaLista} arquivos ficaram de fora`}: o carrossel
            vai até {CARROSSEL_ITENS_MAX}.
          </p>
        )}
      </div>

      {slides.length > 0 && (
        <div className={`${card} space-y-3 p-4`}>
          {forma === "carrossel" && (
            <p className={`text-xs font-medium ${muted}`}>
              {textoDaContagem(validos.length)} O primeiro decide o enquadramento de todos.
            </p>
          )}
          <ol className="space-y-3">
            {linhas.map(({ s, medindo, problema }, i) => (
              <LinhaDoSlide
                key={s.id}
                s={s}
                i={i}
                total={slides.length}
                medindo={medindo}
                problema={problema}
                forma={forma}
                enquadra={enquadra}
                caixa={caixa}
                ocupado={ocupado}
                aoMudarModo={(modo) => mudarModo(s.id, modo)}
                aoMover={(para) => setSlides((atuais) => moverNaOrdem(atuais, i, para))}
                aoRemover={() => remover(s.id)}
              />
            ))}
          </ol>
          {/* A MESMA FRASE QUE A ACTION USARIA AO RECUSAR: aqui ela avisa. */}
          {quantidadeNaTela && <p className={fieldError}>{quantidadeNaTela}</p>}
          {primeiroSlide && <p className={fieldError}>{textoDoProblemaDoPrimeiroSlide(primeiroSlide)}</p>}
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
          disabled={ocupado}
          onChange={(e) => setLegenda(e.target.value)}
          className={input}
          placeholder="O texto que aparece embaixo do post."
        />
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <p className={problemaDaLegendaAtual ? fieldError : hint}>
            {problemaDaLegendaAtual
              ? textoDoProblemaDaLegenda(problemaDaLegendaAtual)
              : "Hashtags e menções contam: 30 e 20 são os limites do Instagram."}
          </p>
          <p className={`shrink-0 text-xs ${numero} ${muted}`}>{legenda.length}/2200</p>
        </div>
      </div>

      {/* A LISTA DOS ENVIOS DENTRO DA TELA, além da janelinha do canto: as duas
          leem o MESMO depósito e a MESMA função pura. */}
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

      {/* O "QUANDO" E AS OPÇÕES DO REELS TRAVAM JUNTO (achado 119). Eles vêm
          prontos da página, de servidor, e sem isso a pessoa trocava "agora" por
          "outra hora" no meio de um reels de minutos: a tela mostrava o valor
          novo, e a action recebia o do clique. O formulário já foi lido antes de
          a tela travar, então travar não tira nada do pedido. */}
      <fieldset disabled={ocupado} className="m-0 min-w-0 space-y-6 border-0 p-0">
        {quando}
        {opcoesDoReels}
      </fieldset>

      {recusa && (
        <p role="alert" className={fieldError}>
          {recusa}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {rodape}
        <button type="button" className={btnPrimary} disabled={ocupado} onClick={() => void publicar()}>
          {ocupado ? "Enviando…" : "Publicar"}
        </button>
      </div>
    </form>
  );
}

/** Depois de cada espera da leva: se a tela saiu no meio, a leva para aqui. */
function seguir(sinal: AbortSignal) {
  if (sinal.aborted) throw new Error("O envio foi interrompido.");
}

/** Uma linha da lista de montagem: a miniatura já enquadrada, o nome, o modo, a ordem e o remover. */
function LinhaDoSlide({
  s,
  i,
  total,
  medindo,
  problema,
  forma,
  enquadra,
  caixa,
  ocupado,
  aoMudarModo,
  aoMover,
  aoRemover,
}: {
  s: Slide;
  i: number;
  total: number;
  medindo: boolean;
  problema: ProblemaDaSaida | null;
  forma: FormaDePublicacao;
  enquadra: boolean;
  caixa: { largura: number; altura: number };
  ocupado: boolean;
  aoMudarModo: (modo: ModoDoEnquadramento) => void;
  aoMover: (para: number) => void;
  aoRemover: () => void;
}) {
  const nome = s.arquivo.name;
  // A MINIATURA É O RESULTADO, desenhado pelo próprio navegador: a caixa tem a
  // proporção do post (`caixaDaMiniatura`), e `object-cover` é o corte ao
  // centro, `object-contain` sobre o branco é a imagem inteira com bordas. É o
  // mesmo enquadramento que `geometriaDoEnquadramento` manda o `canvas` desenhar,
  // sem `canvas` nenhum na tela. O vídeo, que não é recortado, aparece com
  // `object-cover` na caixa: é o corte que o Instagram faz.
  const ajuste = s.video || !enquadra || s.modo === "cortar" ? "object-cover" : "object-contain";
  return (
    <li className="flex items-start gap-3 text-xs" aria-label={nome}>
      <span className={`${numero} ${muted} pt-1`}>{i + 1}.</span>
      <span
        className="relative block w-16 shrink-0 overflow-hidden rounded-lg border border-traco bg-white dark:border-traco-escuro"
        style={enquadra ? { aspectRatio: `${caixa.largura} / ${caixa.altura}` } : { height: "4rem" }}
      >
        {s.video ? (
          <video src={s.endereco} muted playsInline preload="metadata" className={`h-full w-full ${ajuste}`} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.endereco} alt="" className={`h-full w-full ${enquadra ? ajuste : "object-contain"}`} />
        )}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-zinc-700 dark:text-zinc-300">{nome}</p>
        {medindo ? (
          <p className={muted}>Lendo o arquivo…</p>
        ) : problema ? (
          <p className={fieldError}>{textoDoProblemaDaSaida(problema)}</p>
        ) : s.video && forma === "carrossel" ? (
          <p className={hint}>O Instagram corta este vídeo assim.</p>
        ) : null}
        {enquadra && !s.video && (
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["cortar", "Cortar"],
                ["inteira", "Inteira, com bordas"],
              ] as const
            ).map(([modo, rotulo]) => (
              <button
                key={modo}
                type="button"
                aria-pressed={s.modo === modo}
                disabled={ocupado}
                onClick={() => aoMudarModo(modo)}
                className={`rounded-lg border px-2 py-0.5 ${
                  s.modo === modo
                    ? "border-acao bg-acao/10 dark:border-acao-escuro dark:bg-acao-escuro/15"
                    : "border-traco dark:border-traco-escuro"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        )}
      </div>
      {forma === "carrossel" && (
        <>
          {/* `type="button"` NÃO É DETALHE: sem ele, o padrão do HTML é
              `submit`, e reordenar o carrossel publicaria o post. */}
          <button
            type="button"
            aria-label={`Subir ${nome}`}
            disabled={ocupado || i === 0}
            onClick={() => aoMover(i - 1)}
            className="rounded-lg px-2 py-0.5 text-zinc-600 enabled:hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-300 dark:enabled:hover:bg-zinc-800"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`Descer ${nome}`}
            disabled={ocupado || i === total - 1}
            onClick={() => aoMover(i + 1)}
            className="rounded-lg px-2 py-0.5 text-zinc-600 enabled:hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-300 dark:enabled:hover:bg-zinc-800"
          >
            ↓
          </button>
        </>
      )}
      <button
        type="button"
        aria-label={`Remover ${nome}`}
        disabled={ocupado}
        onClick={aoRemover}
        className="rounded-lg px-2 py-0.5 text-zinc-600 enabled:hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-300 dark:enabled:hover:bg-zinc-800"
      >
        Remover
      </button>
    </li>
  );
}

/** A mensagem de um erro que veio de qualquer lugar, sem despejar o objeto (que pode carregar a URL assinada). */
function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error && erro.message ? erro.message : "O envio não foi.";
}
