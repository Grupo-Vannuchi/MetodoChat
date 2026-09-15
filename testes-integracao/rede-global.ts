// A REDE DEBAIXO DA FUNDAÇÃO — `globalSetup` do vitest, roda no processo
// principal, uma vez antes e uma vez depois da rodada inteira.
//
// Ela existe por uma razão só: schema temporário órfão é LIXO EM PRODUÇÃO. O
// `afterAll` do harness derruba o schema mesmo quando o teste falha, mas há
// buracos que gancho de teste nenhum fecha — um `process.exit` no meio, um
// travamento morto por timeout, um Ctrl+C. Esta rede recolhe o que sobrar.
//
// E ela não recolhe em silêncio: se achou alguma coisa, DERRUBA e depois LANÇA.
// Uma rede que limpa calada ensina a confiar no lugar errado — o que interessa
// saber é que um schema escapou, não que alguém varreu depois.
//
// A trava de prefixo é a mesma do harness, importada e não copiada: só some
// schema cujo nome case `teste_tmp_[a-z0-9_]{1,40}`.
import {
  PREFIXO_OBRIGATORIO,
  alvoEBancoDeTeste,
  destruirSchema,
  fecharAdmin,
  schemasTemporariosRestantes,
} from "./banco-descartavel";

/**
 * O ALVO DA RODADA, dito em voz alta antes de qualquer caso.
 *
 * ELE MORA AQUI POR UMA RAZÃO MEDIDA em 15/09/2026, e não por gosto: o vitest
 * ENGOLE `console` da avaliação de módulo E de dentro de caso que passa. Foram
 * duas tentativas antes desta. O `globalSetup` é o único canal desta suíte cujo
 * texto aparece sempre — as linhas "[rede-global] antes da rodada" provam isso
 * em toda execução.
 *
 * E PRECISA APARECER: contra o banco de teste, DOIS arquivos pulam — os que
 * provam o estado do `public` de PRODUÇÃO. Uma rodada verde escondendo que
 * essas duas provas não rodaram é pior do que uma rodada vermelha.
 */
function anunciarOAlvo(): void {
  if (alvoEBancoDeTeste()) {
    console.log(
      "[rede-global] ALVO: banco de TESTE (DATABASE_URL_TESTES). Os arquivos " +
        "`fundacao` e `esquema-base` PULAM — eles provam o `public` de PRODUÇÃO. " +
        "Rode sem DATABASE_URL_TESTES antes do merge."
    );
    return;
  }
  console.log(
    "[rede-global] ALVO: o banco da DATABASE_URL — o MESMO que atende o painel. " +
      "Todos os arquivos rodam, e a suíte disputa vaga de conexão com quem estiver usando."
  );
}

async function recolher(quando: string): Promise<void> {
  const restantes = await schemasTemporariosRestantes();
  if (!restantes.length) {
    console.log(`[rede-global] ${quando}: nenhum schema ${PREFIXO_OBRIGATORIO}* no banco.`);
    return;
  }
  for (const nome of restantes) await destruirSchema(nome);
  throw new Error(
    `[rede-global] ${quando}: sobrou schema temporário em produção, e ele foi ` +
      `derrubado agora: ${restantes.join(", ")}. A destruição do harness falhou ` +
      `em algum arquivo — isso é defeito, não sujeira.`
  );
}

export async function setup(): Promise<void> {
  anunciarOAlvo();
  // Antes: se sobrou coisa de uma rodada anterior, é melhor saber agora.
  try {
    await recolher("antes da rodada");
  } finally {
    await fecharAdmin();
  }
}

export async function teardown(): Promise<void> {
  try {
    await recolher("depois da rodada");
  } finally {
    await fecharAdmin();
  }
}
