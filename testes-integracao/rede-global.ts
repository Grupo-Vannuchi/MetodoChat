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
  destruirSchema,
  fecharAdmin,
  schemasTemporariosRestantes,
} from "./banco-descartavel";

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
