// Tipos compartilhados pelas peças da tela de automação: o seletor de mídia, o
// painel do nó de gatilho, a prévia da conversa e o passo de criação.
//
// `Account` MORREU AQUI junto com `phone-preview.tsx`, que era quem o lia: a
// prévia nova (`editor/previa.tsx`) desenha a moldura sem a conta conectada, e
// o motivo está escrito lá. Quem precisa da conta de verdade continua indo em
// `lib/account.ts`, no servidor.

// O que a API /api/media devolve para cada post ou story.
export type Media = {
  id: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  caption?: string;
  permalink?: string;
};

// O post ou story já escolhido. Guarda a miniatura e a legenda junto do id
// porque o formulário salva os três — assim a automação continua mostrando a
// capa mesmo que a publicação saia do alcance da API depois.
export type Picked = { id: string; thumb: string; caption: string };

// `abertura` é o quarto, e ele não casa por texto: quem dispara é o toque numa
// pergunta de abertura da conta (`payloadDaPergunta`, lib/steps.ts). Quem lê
// este tipo e mostra campo de palavra-chave precisa perguntar antes a
// `gatilhoPedePalavraChave` (lib/steps.ts).
export type TriggerKind = "comment" | "story" | "dm" | "abertura";
