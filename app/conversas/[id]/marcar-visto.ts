"use server";
import { getSelectedAccount } from "@/lib/account";
import { sql } from "@/lib/db";

// Registra que esta conversa foi vista agora.
//
// É Server Action, chamada pelo CLIENTE, e isso não é preferência de estilo. A
// lista usa <Link>, e o prefetch do Next renderiza a página no servidor sem
// ninguém abrir nada — três conversas apareceram renderizadas no log de rede
// durante outro teste. Gravar isto na renderização marcaria como lida toda
// conversa que passasse perto do mouse, e o sintoma seria "às vezes as não
// lidas somem sozinhas": impossível de reproduzir sob demanda.
//
// ESTA AÇÃO NUNCA CHAMOU `ensureSchema`, e o motivo virou história em 26/08.
// Ele rodava ~40 instruções DDL e esta ação dispara a cada conversa aberta — era
// a parte mais cara de um ciclo que, num laço de refresh, esgotou o pool de
// conexões e devolveu 504 em produção. A exceção que este arquivo abria à mão
// virou a regra: `ensureSchema` foi apagado, e NENHUM caminho da aplicação
// carrega DDL. A estrutura é responsabilidade de `migrations/`, e quem confere
// que ela chegou é `exigirEsquema()` (lib/esquema.ts), uma vez por instância.
// OS DOIS `return;` ABAIXO FICAM MUDOS DE PROPÓSITO, e a razão é uma só para
// os dois: esta ação dispara SOZINHA, sem clique nenhum — a cada conversa
// aberta (chamada por `visto.tsx`) e, pelo `Atualizador` de
// `app/conversas/layout.tsx`, A CADA 30 SEGUNDOS enquanto a aba de Conversas
// está visível, para toda conversa da lista.
//
// UM AVISO AQUI TOCARIA SOZINHO O DIA INTEIRO. `contactIgId` fora do formato
// ou conta ausente não são erros do dono — são o mesmo tipo de guarda de
// entrada malformada de `selectAccount` (app/account-actions.ts) —, mas ao
// contrário daquela ação, esta roda em loop: uma faixa de erro que reaparece a
// cada 30 segundos treina o dono a ignorá-la, o mesmo problema que o registro
// em Atividade de `handleMessagingEvent` (lib/engine.ts) já teve e corrigiu
// (ver o comentário de "botão sem caminho" lá) — e esta ação não tem para onde
// redirecionar: ela é chamada de dentro de um componente de cliente, sem
// formulário, sem navegação, então não há tela para carregar um `?aviso=`.
//
// O `console.warn` mais abaixo, no caso de zero linhas afetadas, continua
// existindo: ele é a saída para quem lê o LOG do servidor, não para a tela —
// que é exatamente o registro certo para algo que dispara sozinho.
//
// Este comentário existe para a próxima varredura não tratar estes dois
// `return;` como esquecimento.
export async function marcarVisto(contactIgId: string): Promise<void> {
  if (!/^\d{1,32}$/.test(contactIgId)) return;
  const account = await getSelectedAccount();
  if (!account) return;
  // `returning` é o que torna o resultado confiável: sem ele, o postgres.js
  // devolve um array SEMPRE vazio (o afetado vai só em `.count`, não em
  // `.length`) — testado direto contra o banco antes de escrever esta
  // condição. Com `returning ig_id`, `.length` reflete de verdade quantas
  // linhas o update tocou.
  const r = await sql().query(
    `update contacts set last_seen_at = now()
     where account_id = $1 and ig_id = $2
     returning ig_id`,
    [account.ig_user_id, contactIgId]
  );
  if (!Array.isArray(r) || r.length === 0) {
    // Sem linha em contacts, o badge dessa conversa nunca se apaga. Não é
    // erro fatal, mas precisa aparecer em algum lugar: sem isso o sintoma
    // seria uma conversa eternamente "não lida" e nenhuma pista do motivo.
    console.warn(
      `[marcarVisto] nenhuma linha em contacts para account_id=${account.ig_user_id} ig_id=${contactIgId}`
    );
  }

  // Quem faz o badge sumir da lista é o router.refresh() do lado do cliente,
  // em visto.tsx — não uma revalidação daqui.
  //
  // Isto já foi `revalidatePath("/conversas", "layout")` e NÃO funcionava:
  // medido contra build de produção, a gravação acontecia e a lista continuava
  // mostrando "26" indefinidamente. O motivo é que o layout de /conversas é
  // `force-dynamic`, então não existe cache de servidor para invalidar — o que
  // precisa ser refeito é a árvore que o navegador já tem na mão.
}
