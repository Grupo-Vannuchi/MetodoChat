import { describe, expect, it } from "vitest";
import { gatilhoGuardaPost, gatilhoGuardaStory } from "@/lib/steps";

// QUAL ALVO O GATILHO GUARDA.
//
// `media_id` só significa alguma coisa para `comment`, e `story_id` só para
// `story` — quem manda é `findMatch` (lib/engine.ts:257-258). Gravar o outro
// NÃO é sujeira inofensiva: três linhas abaixo, `findMatch` (lib/engine.ts:263)
// desempata com `candidates.find((a) => trigger === "story" ? a.story_id :
// a.media_id)`, e para o gatilho `dm` esse `a.media_id` continua sendo
// consultado. Um `media_id` sobrando faria a automação ganhar o desempate de
// uma DM por causa de um post que não tem nada a ver com a conversa.
//
// MEDIDO em produção em 16/09/2026: 27 automações têm `media_id` e TODAS têm o
// gatilho `comment`; NENHUMA automação usa `dm`. Latente hoje — e é por isso
// que precisa de portão: quando a primeira automação de DM nascer, ninguém vai
// estar procurando por isto.

const GATILHOS = ["comment", "story", "dm", "abertura"];

describe("gatilhoGuardaPost", () => {
  it("só `comment` guarda post", () => {
    expect(GATILHOS.filter(gatilhoGuardaPost)).toEqual(["comment"]);
  });

  it("`dm` NÃO guarda — é o caso que o desempate de findMatch estragava", () => {
    expect(gatilhoGuardaPost("dm")).toBe(false);
  });

  it("gatilho desconhecido não guarda", () => {
    // `GATILHOS` (app/automacoes/actions.ts) é conferido antes, então este ramo
    // só existe se alguém acrescentar um gatilho novo e esquecer daqui. Nesse
    // dia, não gravar é o desfecho que não inventa roteamento.
    expect(gatilhoGuardaPost("gatilho_que_nao_existe")).toBe(false);
  });
});

describe("gatilhoGuardaStory", () => {
  it("só `story` guarda story", () => {
    expect(GATILHOS.filter(gatilhoGuardaStory)).toEqual(["story"]);
  });

  it("os dois não se confundem", () => {
    // O par importa: trocar um pelo outro guardaria o post na coluna do story.
    expect(gatilhoGuardaPost("story")).toBe(false);
    expect(gatilhoGuardaStory("comment")).toBe(false);
  });
});
