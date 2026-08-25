import { defineConfig } from "vitest/config";
import base from "./vitest.config";

// OS TESTES DE INTEGRAÇÃO MORAM FORA DA SUÍTE PADRÃO, E ISTO É REGRA DO DONO.
//
// `npm test` roda função pura: sem banco, sem rede, sem DOM. Os testes desta
// configuração fazem o oposto — falam com o Postgres de produção, num schema
// temporário. São uma CATEGORIA NOVA, e não uma exceção dentro da antiga.
//
// A separação é dupla de propósito, e cada metade sozinha já bastaria:
//
//   1. DIRETÓRIO. O `include` da suíte padrão é `tests/**/*.test.ts`, e estes
//      arquivos vivem em `testes-integracao/`, onde aquele padrão não alcança.
//   2. SUFIXO. Eles se chamam `*.integracao.ts`, e não `*.test.ts`. Mesmo que um
//      deles fosse parar dentro de `tests/` por engano, `npm test` continuaria
//      sem enxergá-lo — o padrão exige o sufixo `.test.ts`.
//
// Por que não `test.projects` (que esta versão do vitest suporta): com projetos,
// um `vitest run` sem argumento roda TODOS os projetos. A suíte padrão passaria
// a tocar o banco por omissão, e só um filtro na linha de comando a salvaria.
// O padrão seguro tem de ser o que acontece quando ninguém digita nada.
//
// O `verify` NÃO chama esta configuração. Ele roda offline hoje, e passar a
// exigir banco é decisão do dono — adiada de propósito.
export default defineConfig({
  // Os mesmos atalhos da suíte padrão, importados e não copiados: o alias de
  // `server-only` para o `empty.js` é o que deixa os módulos de `lib/` carregarem
  // fora do Next, e duas cópias dele acabariam divergindo.
  resolve: base.resolve,
  test: {
    environment: "node",
    include: ["testes-integracao/**/*.integracao.ts"],
    // Montar a estrutura leva ~4s por schema, e o inventário de `public` varre
    // milhares de linhas. Os padrões de 5s do vitest são para função pura.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Um arquivo por vez: cada um abre o seu schema temporário contra o MESMO
    // banco de produção, e o pooler da frente não é nosso para congestionar.
    fileParallelism: false,
    // A rede que impede schema órfão de virar lixo acumulado em produção.
    globalSetup: ["testes-integracao/rede-global.ts"],
  },
});
