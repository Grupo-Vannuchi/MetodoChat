// COMO SE CONECTA A UM POSTGRES — as decisões que dependem só da URL.
//
// MÓDULO PURO, e sem `server-only` de propósito: a suíte de integração precisa
// das mesmas respostas que a aplicação, e um segundo `if` do lado dela seria a
// quinta cópia de uma regra que já tem dono. É a mesma disciplina de
// `KINDS_MANUAIS` (lib/envio-filters.ts) e de `EVENT_TYPES` (lib/event-filters.ts).

/**
 * O parâmetro `ssl` que o driver deve usar para esta URL.
 *
 * `"require"` para qualquer servidor de verdade, e `false` para um Postgres que
 * mora na própria máquina.
 *
 * POR QUE A EXCEÇÃO EXISTE, e ela nasceu em 15/09/2026: a suíte de integração
 * passou a poder rodar contra um container local (`docker-compose.yml`), e a
 * imagem `postgres` oficial **não serve TLS**. Com `ssl: "require"` cravado, a
 * primeira conexão morre com "The server does not support SSL connections" e
 * nenhuma outra explicação.
 *
 * POR QUE NÃO É UM BURACO DE SEGURANÇA: `require` só cai quando o alvo é a
 * própria máquina, onde não há rede para alguém escutar — o tráfego não sai da
 * pilha de rede local. Qualquer outro endereço, inclusive um IP da rede
 * interna, continua exigindo TLS. A lista é FECHADA e literal: nada de "começa
 * com 192.168" nem de "termina com .local", que é como este tipo de exceção
 * costuma vazar.
 *
 * E A DECISÃO É DA URL, E NÃO DO AMBIENTE: uma variável tipo `NODE_ENV` diria
 * "estou em desenvolvimento", que é outra pergunta — em desenvolvimento se
 * conecta no Supabase o tempo todo, e ali o TLS tem de valer.
 */
export function sslDaUrl(url: string): "require" | false {
  let servidor: string;
  try {
    servidor = new URL(url).hostname.toLowerCase();
  } catch {
    // URL que nem se lê não vai conectar de jeito nenhum. Exigir TLS é o lado
    // seguro de uma resposta que não vai ser usada.
    return "require";
  }
  return LOCAIS.has(servidor) ? false : "require";
}

// Os nomes que significam "esta máquina".
//
// O IPv6 APARECE COM COLCHETES, e este comentário já afirmou o contrário: eu
// tinha escrito que `URL.hostname` os tirava. Medido — ele os MANTÉM, e devolve
// `"[::1]"`. Quem pegou foi o caso de `tests/conexao.test.ts`, e a forma sem
// colchetes fica na lista também porque uma URL montada à mão pode chegar assim
// por outro caminho.
const LOCAIS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
