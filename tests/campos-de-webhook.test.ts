import { describe, it, expect } from "vitest";
import { CAMPOS_DE_WEBHOOK } from "@/lib/ig";
import { FORMAS_DO_MOTOR } from "@/lib/webhook-messaging";

// O QUE ESTE ARQUIVO PROTEGE é a MORTE NA ORIGEM — a única deste projeto que
// acontece antes de qualquer linha deste repositório rodar.
//
// `CAMPOS_DE_WEBHOOK` (lib/ig.ts) é a lista que o app assina na Meta. Apagar
// `messaging_postbacks` dela é um token, e ele passa por tsc, por eslint, pelos
// testes puros, pela varredura e pelos de integração — TODOS verdes. E a Meta
// simplesmente PARA DE ENTREGAR o evento: o toque numa pergunta de abertura não
// chega, nenhum código nosso roda, e nenhum teste do projeto tem como notar,
// porque todos eles entregam o evento com a própria mão.
//
// PIOR: `app/setup/subscription-status.tsx` monta `esperados` da MESMA string
// (`CAMPOS_DE_WEBHOOK.split(",")`). O conferidor lê a lista que o inscritor
// escreve, então a tela de Configuração diria "recebendo eventos ✓" para todas
// as contas enquanto nada chega. A tela vira a prova de que está tudo bem
// justamente quando não está — que é o defeito que aquele componente foi escrito
// para acabar, na versão em que ele citava "comments" e "messages" à mão.
//
// A SIMETRIA COM `tests/labels.test.ts` é o motivo de este arquivo existir:
// aquele nasceu porque "app/labels.ts não tinha rede nenhuma", e a frase vale
// palavra por palavra aqui.
//
// ---------------------------------------------------------------------------
// COMO SE MEDE ISTO SEM O TESTE CONCORDAR CONSIGO MESMO
//
// Afirmar "a string contém `messaging_postbacks`" seria perguntar de novo à
// mesma linha que decide — e é exatamente o que a tela de Configuração já faz de
// errado. A pergunta certa vem do OUTRO LADO: o motor declara as formas de
// `entry.messaging[]` que ele trata (`FORMAS_DO_MOTOR`, lib/webhook-messaging.ts),
// e cada uma dessas formas só CHEGA se o app assinar o campo que a entrega. É
// esse par que este arquivo prende — dois arquivos, e não um.
const CAMPO_QUE_ENTREGA: Record<(typeof FORMAS_DO_MOTOR)[number], string> = {
  // Documentação da Meta, página de webhooks da Instagram Platform:
  message: "messages",
  postback: "messaging_postbacks",
};

const assinados = CAMPOS_DE_WEBHOOK.split(",");

describe("toda forma que o motor trata tem campo assinado que a entrega", () => {
  it("nenhuma forma do motor fica sem entrega", () => {
    for (const forma of FORMAS_DO_MOTOR) {
      const campo = CAMPO_QUE_ENTREGA[forma];
      // Um `undefined` aqui é a forma nova entrando em `FORMAS_DO_MOTOR` sem
      // ninguém dizer qual campo a traz — que é a mesma morte na origem, só que
      // um passo antes.
      expect(campo, `nenhum campo de webhook declarado para \`${forma}\``).toBeTruthy();
      expect(
        assinados,
        `o motor trata \`${forma}\`, mas o app não assina \`${campo}\` — ` +
          `a Meta para de entregar e NADA neste repositório roda`
      ).toContain(campo);
    }
  });

  it("o campo dos comentários também está assinado, e é o mesmo nome que a rota lê", () => {
    // `app/api/webhook/route.ts` decide o ramo de comentário com
    // `change.field === "comments"` — o nome do campo assinado, letra por letra.
    // Assinar outra coisa (ou nada) mata a automação de comentário do mesmo
    // jeito silencioso.
    expect(assinados).toContain("comments");
  });

  it("a lista é separável por vírgula sem sobra — é assim que a tela de Configuração a lê", () => {
    // `subscription-status.tsx` faz `CAMPOS_DE_WEBHOOK.split(",")` e compara com
    // o que a Meta relata. Um espaço a mais em torno da vírgula deixaria a tela
    // dizendo "falta assinar: ` messages`" para sempre, com a assinatura certa.
    expect(assinados.length).toBeGreaterThan(0);
    for (const campo of assinados) {
      expect(campo, `\`${campo}\` tem espaço ou está vazio`).toBe(campo.trim());
      expect(campo.length).toBeGreaterThan(0);
    }
    // E sem repetição: a Meta aceita, mas a tela contaria duas vezes o mesmo.
    expect(new Set(assinados).size).toBe(assinados.length);
  });
});

// ---------------------------------------------------------------------------
// O QUE ESTE ARQUIVO **NÃO** PRENDE, de propósito.
//
// `messaging_referral` está assinado hoje e NÃO é afirmado aqui. Ele não tem
// tratamento nenhum no motor — cai em `webhook_messaging_nao_tratado`, que é
// onde o experimento de primeiro contato o observa. Afirmá-lo seria escrever a
// lista duas vezes sem um segundo leitor que a justifique, que é justamente o
// vício que este arquivo existe para não repetir. Quando alguma forma dele
// entrar em `FORMAS_DO_MOTOR`, o primeiro caso acima passa a exigi-lo sozinho.
// ---------------------------------------------------------------------------
