"use client";
import { useMemo, useState } from "react";
import type { Passo } from "@/lib/steps";
import type { Picked } from "../types";
import { card } from "../../ui";
import {
  IconAlert,
  IconCamera,
  IconChevronLeft,
  IconClock,
  IconComment,
  IconImage,
  IconMail,
  IconMic,
  IconPhone,
  IconSmile,
  IconTap,
  IconUsers,
  IconVideo,
  IconWifi,
} from "../../icons";
import { roteiro, type Bolha, type Cena } from "./roteiro";

// A PRÉVIA DA CONVERSA, lendo a lista de blocos.
//
// POR QUE ELA NASCEU EM VEZ DE `phone-preview.tsx` GANHAR UMA PROP: aquela
// recebia TREZE props achatadas — `welcomeText`, `quickReplyLabel`,
// `linkText`/`linkButtonLabel`/`linkUrl`, `reminderText`/`reminderDelay`,
// `requireFollow`/`followText`/`followButtonLabel`, `askEmail`/`emailText`,
// `storyReaction` — e montava a conversa numa ORDEM FIXA escrita no JSX dela.
// Eram as caixas do formulário, uma a uma. O quadro produz uma lista ORDENADA
// e REPETÍVEL (duas mensagens seguidas, um link antes do portão, uma espera no
// meio), e não há prop que faça um slot por papel virar uma lista livre.
//
// As duas coexistiram por UMA tarefa: `phone-preview.tsx` foi apagada junto com
// `form.tsx`, e esta é a única prévia que resta. A moldura, o cabeçalho, os
// balões e as pílulas foram COPIADOS de lá de propósito — adaptar o miolo
// daquele arquivo para depois apagá-lo custaria mais e mexeria numa tela que
// então funcionava.
//
// O QUE DESENHAR sai de `./roteiro`, que é puro e testado. Aqui só mora COMO.
// Uma decisão de conteúdo escrita neste arquivo é uma decisão sem teste, e foi
// isso que deu defeito em toda tarefa desta fase.

// ---------------------------------------------------------------------------
// As peças da moldura, copiadas de `phone-preview.tsx`.
// ---------------------------------------------------------------------------

// SEM `Account`, e a ausência é escolha, não esquecimento: quem monta o quadro
// (`quadro.tsx`) não recebe a conta conectada — a página que o monta
// (`app/automacoes/[id]/page.tsx`) lê a automação e a configuração, e não passa
// a conta adiante. Inventar a prop seria plumbing morto atravessando três
// arquivos até alguém ter o que pôr nela. O avatar cai no mesmo espaço reservado
// que a prévia antiga usava quando não havia conta.
// A conta conectada, só o que a prévia precisa para deixar de inventar.
//
// Vem da página, que já a busca para saber de quem é a automação — o caminho é
// página → quadro → aqui, e nenhum dos três a consulta de novo.
export type ContaDaPrevia = {
  usuario: string | null;
  nome: string | null;
  foto: string | null;
};

// A foto real da conta, com a inicial como reserva.
//
// A reserva não é enfeite: a foto vem de uma URL da Meta que EXPIRA, e conta
// recém-conectada pode ainda não tê-la. Cair num círculo com a inicial é melhor
// do que um quadrado quebrado — e a inicial sai do @, que é o que a pessoa
// reconhece.
//
// O `onError` é o que faz a reserva valer no caso que importa: url ausente é
// fácil, mas url EXPIRADA continua sendo string não-vazia, e sem ele a tela
// mostraria a imagem quebrada justamente no caso que o comentário acima nomeia.
// É a mesma solução, pelo mesmo motivo, de `app/avatar.tsx`.
function MiniAvatar({ conta, size = "h-5 w-5" }: { conta: ContaDaPrevia; size?: string }) {
  const [falhou, setFalhou] = useState(false);
  if (conta.foto && !falhou) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={conta.foto}
        alt=""
        onError={() => setFalhou(true)}
        className={`${size} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-orange-400 text-[9px] font-bold text-white`}
    >
      {(conta.usuario ?? "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

// O que A CONTA manda. Fica à esquerda, com avatar: a prévia é o celular de
// QUEM RECEBE, então a mensagem da automação chega, e a da pessoa sai.
function Recebida({ conta, children }: { conta: ContaDaPrevia; children: React.ReactNode }) {
  return (
    <div className="flex max-w-[85%] items-end gap-1.5 self-start">
      <MiniAvatar conta={conta} />
      <div className="min-w-0 overflow-hidden rounded-2xl rounded-bl-md bg-zinc-800 text-[11px] leading-snug text-zinc-100">
        {children}
      </div>
    </div>
  );
}

// O que A PESSOA manda: o toque no botão (que entra na conversa como mensagem
// dela) ou o texto que ela digita.
function Enviada({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[80%] self-end break-words rounded-2xl rounded-br-md bg-[#3797f0] px-3 py-1.5 text-[11px] leading-snug text-white">
      {children}
    </div>
  );
}

function Legenda({ icone, children }: { icone?: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="my-0.5 flex items-center gap-1 self-center text-center text-[9px] text-zinc-500">
      {icone}
      {children}
    </p>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <span className="italic text-zinc-500">{texto}</span>;
}

// A pílula de resposta rápida: o botão que a pessoa TOCA. Solta abaixo do
// balão, e não dentro dele — é assim que o Instagram a desenha, e é o que
// separa visualmente o botão que abre um endereço (dentro do balão) do botão
// que o fluxo fica esperando.
function Pilula({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-0.5 self-center rounded-full border border-[#3797f0]/60 bg-[#3797f0]/10 px-3 py-1 text-[10px] font-medium text-[#3797f0]">
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// A MARCA DA PARADA — a informação mais valiosa desta tela.
//
// AS CORES NÃO SÃO ESCOLHA LIVRE: são as mesmas três que o editor já usa, e
// mudá-las quebraria a ligação entre o que a pessoa lê aqui e a borda do bloco
// lá no quadro.
//
//   ÂMBAR — ninguém passa sem cumprir. É a cor da borda do `pedir_follow`
//     (`no.tsx`) e a do aviso "o fluxo para aqui" do painel, que é justamente o
//     da `dm` de resposta rápida. Os dois casos vivem aqui.
//   TEAL — pede uma informação e para até recebê-la, MAS quem chegar do outro
//     lado por outro caminho passa. É o `pedir_email`, e a distinção é real: a
//     regra do portão (`atravessandoOPortao`, lib/steps.ts) cobre `pedir_follow`
//     e mais nada.
//
// O TEXTO DE CADA UMA diz o que destrava, e não só que parou. "O fluxo para
// aqui" sozinho não ajuda quem está montando a decidir o que fazer.
// ---------------------------------------------------------------------------
const PARADAS = {
  toque: {
    icone: <IconTap className="h-3 w-3 shrink-0" />,
    titulo: "o fluxo para aqui",
    texto: "O que vem depois só sai quando a pessoa tocar no botão. Nada mais a destrava.",
    cor: "border-amber-400/60 bg-amber-400/10 text-amber-300",
    corDoTexto: "text-amber-200/90",
  },
  follow: {
    icone: <IconUsers className="h-3 w-3 shrink-0" />,
    titulo: "portão: para aqui até seguir",
    texto: "Quem não segue o perfil não passa daqui — e quem deixar de seguir volta para cá.",
    cor: "border-amber-400/60 bg-amber-400/10 text-amber-300",
    corDoTexto: "text-amber-200/90",
  },
  email: {
    icone: <IconMail className="h-3 w-3 shrink-0" />,
    titulo: "para aqui até o e-mail chegar",
    texto: "Não é portão: quem alcançar um bloco adiante por outro caminho passa sem responder.",
    cor: "border-teal-400/60 bg-teal-400/10 text-teal-300",
    corDoTexto: "text-teal-200/90",
  },
} as const;

function Parada({ motivo }: { motivo: "toque" | "follow" | "email" }) {
  const p = PARADAS[motivo];
  return (
    <div className={`my-1 self-stretch rounded border border-dashed px-2 py-1.5 ${p.cor}`}>
      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide">
        {p.icone}
        {p.titulo}
      </p>
      <p className={`mt-0.5 text-[9px] leading-snug ${p.corDoTexto}`}>{p.texto}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Uma bolha do roteiro virando tela.
// ---------------------------------------------------------------------------
// A moldura das marcas que NÃO são mensagem — a resposta pública e o
// coraçãozinho fora do gatilho. Uma só, porque o enquadramento é o mesmo: uma
// caixa tracejada e apagada, que nunca pode ser confundida com um balão.
function Marca({
  icone,
  titulo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="my-0.5 self-stretch rounded border border-dashed border-zinc-700 px-2 py-1.5">
      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
        {icone}
        {titulo}
      </p>
      <p className="mt-0.5 text-[9px] leading-snug text-zinc-500">{children}</p>
    </div>
  );
}

// O QUE O CARTÃO DO POST DIZ SOBRE UMA RESPOSTA PÚBLICA. A frase é montada
// aqui, mas os NÚMEROS e a SITUAÇÃO vêm de `./roteiro`, que é puro e testado —
// a decisão de conteúdo é de lá, a redação é daqui.
function recadoDaPublica(b: Extract<Bolha, { tipo: "publica" }>): string {
  if (b.situacao === "fora_do_gatilho")
    return "Neste gatilho ela não é publicada: só o comentário traz o post a responder.";
  // A SEGUNDA NÃO SAI, e mandá-la olhar "acima" apontava para o texto da
  // PRIMEIRA — o único que o cartão do post desenha. `commentReplyKey`
  // (lib/dedupe.ts) é a mesma para as duas, e o `on conflict do nothing` engole
  // esta. É o mesmo mecanismo que `conferirLista` (lib/steps.ts) acusa como
  // ERRO, e a prévia agora diz a mesma coisa em vez de contradizê-lo.
  if (b.situacao === "repetida")
    return "Esta é a segunda resposta pública da lista, e ela não é publicada: sai com a mesma chave de envio da primeira. O cartão acima mostra a primeira.";

  // UMA VARIAÇÃO EM BRANCO NÃO É DETALHE: o motor sorteia uma das linhas e
  // desiste quando a sorteada não tem nada escrito, então a resposta some
  // naquele disparo. Logo depois do Enter — o gesto normal para criar a segunda
  // variação — é exatamente o estado da lista, e "uma das 2 variações,
  // sorteada" prometia duas.
  if (b.variacoes > 1) {
    const aviso = b.vazias
      ? ` — ${b.vazias === 1 ? "1 delas está em branco e, quando ela é sorteada" : `${b.vazias} delas estão em branco e, quando uma delas é sorteada`}, nada é publicado`
      : "";
    return `Sai no comentário do post, acima — uma das ${b.variacoes} variações, sorteada${aviso}.`;
  }
  return "Sai no comentário do post, acima.";
}

// O QUE A CENA DO CORAÇÃOZINHO DIZ, por alvo. O `nenhum` é o caso que a prévia
// escondia: no gatilho de comentário o bloco não roda — `conferirLista`
// (lib/steps.ts) já acusa ERRO —, e a cena prometia "reage à mensagem que a
// pessoa mandou" logo abaixo do mesmo erro.
const REACAO = {
  story: "reage à resposta que a pessoa mandou ao story",
  mensagem: "reage à mensagem que a pessoa mandou",
} as const;

function Item({ bolha, conta }: { bolha: Bolha; conta: ContaDaPrevia }) {
  switch (bolha.tipo) {
    case "balao":
      return (
        <>
          <Recebida conta={conta}>
            <p className="whitespace-pre-wrap break-words px-3 py-1.5">
              {bolha.texto || <Vazio texto="Sem texto…" />}
            </p>
            {/* O botão de LINK vai DENTRO do balão, como no Instagram: ele abre
                um endereço e a conversa segue. O de resposta rápida vira
                pílula, abaixo — é ele que o fluxo fica esperando. */}
            {bolha.link && bolha.botao && (
              <p className="border-t border-zinc-700 px-3 py-1.5 text-center font-semibold text-[#3797f0]">
                {bolha.botao}
              </p>
            )}
          </Recebida>
          {!bolha.link && bolha.botao && <Pilula>{bolha.botao}</Pilula>}
        </>
      );

    case "parada":
      return <Parada motivo={bolha.motivo} />;

    case "resposta":
      return <Enviada>{bolha.texto}</Enviada>;

    case "tempo":
      return <Legenda icone={<IconClock className="h-2.5 w-2.5" />}>{bolha.texto}</Legenda>;

    // A RESPOSTA PÚBLICA NÃO É DM, e por isso não é balão: ela sai no
    // comentário do post. O cartão do post, acima do celular, mostra o texto
    // dela onde ele de fato aparece; esta marca fica na conversa só para dizer
    // ONDE, NA LISTA, o bloco está — sem ela, o bloco sumiria da prévia e quem
    // o arrastasse para outro lugar não veria nada mudar.
    //
    // QUAL DOS TRÊS RECADOS SAI é decisão de `./roteiro` (a `situacao`), não
    // desta tela: fora do gatilho não há cartão acima, e a segunda da lista não
    // é publicada. Nos dois casos "veja acima" apontava para a coisa errada.
    case "publica":
      return (
        <Marca
          icone={<IconComment className="h-3 w-3 shrink-0" />}
          titulo="resposta pública — fora da conversa"
        >
          {recadoDaPublica(bolha)}
        </Marca>
      );

    // O coraçãozinho também não é balão: é uma reação NA MENSAGEM que a pessoa
    // mandou. Fica no lugar dele na lista, como marca.
    //
    // FORA DOS GATILHOS QUE ENTREGAM MENSAGEM ele não roda, e aí a cena troca
    // de forma, não só de texto: uma legenda apagada dizendo que não sai se
    // perderia no meio dos balões, e este é o bloco em que `conferirLista`
    // (lib/steps.ts) acende ERRO.
    case "reacao":
      return bolha.alvo === "nenhum" ? (
        <Marca icone={<span className="text-[11px]">{bolha.emoji}</span>} titulo="coraçãozinho">
          Neste gatilho ele não sai: não chega nenhuma mensagem a que reagir.
        </Marca>
      ) : (
        <Legenda>
          <span className="text-[11px]">{bolha.emoji}</span>
          {REACAO[bolha.alvo]}
        </Legenda>
      );

    // BLOCO QUE NÃO É ENVIADO. `interpretar` (lib/steps.ts) o ignora, então
    // desenhá-lo como mensagem seria a prévia prometendo um envio que não
    // acontece. Ele aparece — para quem monta saber onde ele está —, mas nunca
    // com cara de mensagem entregue.
    case "incompleto":
      return (
        <div className="my-0.5 self-stretch rounded border border-dashed border-red-500/60 bg-red-500/10 px-2 py-1.5">
          <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-red-300">
            <IconAlert className="h-3 w-3 shrink-0" />
            este bloco não é enviado
          </p>
          <p className="mt-0.5 text-[9px] leading-snug text-red-200/90">{bolha.mensagem}</p>
        </div>
      );
  }
}

// Tudo o que um bloco desenha, junto — e é o agrupamento que permite acender o
// bloco que está aberto no painel.
//
// O DESTAQUE É INDIGO porque indigo é a cor da seleção no quadro (`no.tsx`), e
// a prévia só liga o que a pessoa está digitando ao que ela vê se as duas
// telas usarem a mesma cor para "este é o bloco aberto".
function CenaNaConversa({ cena, aceso, conta }: { cena: Cena; aceso: boolean; conta: ContaDaPrevia }) {
  return (
    <div
      className={`flex flex-col gap-1.5 ${
        aceso ? "-mx-1.5 rounded-lg bg-indigo-500/10 px-1.5 py-1 ring-1 ring-indigo-400/70" : ""
      }`}
    >
      {cena.itens.map((b, i) => (
        <Item key={i} bolha={b} conta={conta} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function Previa({
  passos,
  gatilho,
  palavras,
  correspondencia,
  post,
  story,
  indiceSelecionado,
  conta,
}: {
  passos: Passo[];
  gatilho: string;
  palavras: string[];
  correspondencia: string;
  post: Picked | null;
  story: Picked | null;
  // A conta conectada. A prévia mostrava `sua_conta` e uma inicial fixa, o que
  // faz a tela parecer um exemplo em vez do fluxo desta conta.
  //
  // OPCIONAL de propósito, e não por preguiça: esta prop chegou `undefined` uma
  // vez por um comentário mal posicionado na página que a monta, e o efeito foi
  // a ROTA INTEIRA cair — não a prévia ficar sem foto. Um dado de enfeite não
  // pode derrubar a tela onde se edita o fluxo.
  conta?: ContaDaPrevia;
  // O bloco aberto no painel, para acender na prévia. -1 quando o selecionado é
  // o gatilho, ou quando não há nenhum.
  indiceSelecionado: number;
}) {
  // O GATILHO ENTRA NO ROTEIRO, e não só na moldura desta tela: dois dos seis
  // tipos só rodam em alguns gatilhos, e essa decisão é de conteúdo — ela mora
  // no arquivo puro, com teste. Antes o coraçãozinho saía igual nos três.
  const cenas = useMemo(() => roteiro(passos, gatilho), [passos, gatilho]);

  // Sem conta, a prévia continua desenhando — só sem identidade.
  const perfil: ContaDaPrevia = conta ?? { usuario: null, nome: null, foto: null };

  // A RESPOSTA PÚBLICA sai no comentário, então ela é desenhada no cartão do
  // post — não na conversa. Só a PUBLICADA entra aqui: `conferirLista`
  // (lib/steps.ts) trata a segunda como ERRO porque a chave de deduplicação não
  // conhece o bloco, e desenhar o texto da segunda no cartão mostraria no post
  // um comentário que nunca é publicado.
  const publica = useMemo(() => {
    for (const c of cenas) {
      for (const b of c.itens) if (b.tipo === "publica" && b.situacao === "publicada") return b.texto;
    }
    return null;
  }, [cenas]);

  // O QUE A PESSOA DIGITA PARA DISPARAR. Com "Qualquer texto" não há palavra
  // nenhuma a mostrar, e desenhar uma seria mentira — aquela automação casa com
  // TODA mensagem, de todo mundo. Por isso o exemplo, nesse caso, é uma
  // mensagem qualquer, e não uma palavra-chave.
  const disparo =
    correspondencia === "any"
      ? "oi, tudo bem?"
      : palavras.find((p) => p.trim()) || "sua palavra-chave";

  return (
    <div>
      {/* A CENA DO COMENTÁRIO acontece NO POST, fora da DM — é por isso que ela
          fica fora do celular. É também onde a resposta pública aparece, e é
          esse enquadramento que a impede de se confundir com uma mensagem. */}
      {gatilho === "comment" && (
        <div className={`mb-3 p-3 ${card}`}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            No post
          </p>
          <div className="flex gap-2.5">
            {post?.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.thumb} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                <IconImage className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0 break-words text-[11px] leading-snug text-zinc-700 dark:text-zinc-300">
              <p>
                <span className="font-semibold">@visitante</span> {disparo}
              </p>
              {publica !== null && (
                <p className="mt-1 border-l border-zinc-300 pl-2 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {perfil.usuario ? `@${perfil.usuario}` : "Sua conta"}
                  </span>{" "}
                  {publica || <Vazio texto="sem texto — nada é publicado" />}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-[300px] overflow-hidden rounded-[2.4rem] border-[5px] border-zinc-800 bg-black shadow-2xl">
        {/* Barra de status */}
        <div className="relative flex items-center justify-between px-5 pb-1 pt-2 text-[9px] font-semibold text-zinc-200">
          <span>9:41</span>
          <span className="absolute left-1/2 top-1.5 h-4 w-16 -translate-x-1/2 rounded-full bg-zinc-900" />
          <span className="flex items-center gap-1">
            <span className="flex items-end gap-[2px]">
              <span className="h-1 w-[2.5px] rounded-sm bg-zinc-200" />
              <span className="h-1.5 w-[2.5px] rounded-sm bg-zinc-200" />
              <span className="h-2 w-[2.5px] rounded-sm bg-zinc-200" />
              <span className="h-2.5 w-[2.5px] rounded-sm bg-zinc-500" />
            </span>
            <IconWifi className="h-3 w-3" />
            <span className="flex h-2.5 w-[18px] items-center rounded-[3px] border border-zinc-500 p-[1.5px]">
              <span className="h-full w-3/4 rounded-[1px] bg-zinc-200" />
            </span>
          </span>
        </div>

        {/* Cabeçalho da DM */}
        <div className="flex items-center gap-2 border-b border-zinc-800/80 px-3 py-2">
          <IconChevronLeft className="h-4 w-4 text-zinc-300" />
          <span className="rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px]">
            <span className="block rounded-full bg-black p-[2px]">
              <MiniAvatar conta={perfil} size="h-6 w-6" />
            </span>
          </span>
          <div className="min-w-0 leading-tight">
            {/* Nome em cima e @ embaixo, que é a ordem do direct de verdade.
                Sem nome, o @ sobe — repetir o @ nas duas linhas ficaria pior do
                que mostrar uma linha só. */}
            <p className="truncate text-xs font-semibold text-zinc-100">
              {perfil.nome ?? (perfil.usuario ? `@${perfil.usuario}` : "Sua conta")}
            </p>
            {perfil.nome && perfil.usuario && (
              <p className="truncate text-[9px] text-zinc-500">@{perfil.usuario}</p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3 text-zinc-300">
            <IconPhone className="h-4 w-4" />
            <IconVideo className="h-4 w-4" />
          </div>
        </div>

        {/* A conversa */}
        <div className="flex min-h-[340px] flex-col gap-1.5 px-3 py-3">
          <Legenda>Hoje</Legenda>

          {/* QUEM DISPARA APARECE, porque a primeira mensagem da conversa é a
              dela. No gatilho de comentário não há mensagem nenhuma aqui — ela
              comentou, não mandou DM —, e é por isso que este ramo não cobre os
              três: a conversa começa direto na resposta da automação. */}
          {gatilho === "story" && (
            <div className="flex flex-col items-end gap-1 self-end">
              <p className="text-[9px] text-zinc-500">Respondeu ao seu story</p>
              <span className="rounded-xl bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px]">
                {story?.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={story.thumb}
                    alt=""
                    className="block h-20 w-12 rounded-[10px] object-cover"
                  />
                ) : (
                  <span className="flex h-20 w-12 items-center justify-center rounded-[10px] bg-zinc-900 text-zinc-500">
                    <IconCamera className="h-4 w-4" />
                  </span>
                )}
              </span>
              <Enviada>{disparo}</Enviada>
            </div>
          )}
          {gatilho === "dm" && <Enviada>{disparo}</Enviada>}

          {cenas.map((c) => (
            <CenaNaConversa
              key={c.indice}
              cena={c}
              aceso={c.indice === indiceSelecionado}
              conta={perfil}
            />
          ))}

          {/* LISTA VAZIA NÃO QUEBRA A TELA, e também não fica muda: sem nenhum
              bloco a automação não envia nada, que é o mesmo que `conferirLista`
              diz no painel. */}
          {!cenas.length && (
            <div className="my-2 self-stretch rounded border border-dashed border-zinc-700 px-2 py-3 text-center">
              <p className="text-[10px] leading-snug text-zinc-500">
                Nenhum bloco ainda — arraste um da paleta e a conversa aparece aqui.
              </p>
            </div>
          )}
        </div>

        {/* Barra de mensagem */}
        <div className="flex items-center gap-2 px-2.5 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3797f0] text-white">
            <IconCamera className="h-3.5 w-3.5" />
          </span>
          <span className="flex-1 rounded-full border border-zinc-800 px-3 py-1.5 text-[11px] text-zinc-500">
            Mensagem…
          </span>
          <span className="flex items-center gap-2.5 text-zinc-400">
            <IconMic className="h-4 w-4" />
            <IconImage className="h-4 w-4" />
            <IconSmile className="h-4 w-4" />
          </span>
        </div>
        <div className="pb-1.5">
          <div className="mx-auto h-1 w-24 rounded-full bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}
