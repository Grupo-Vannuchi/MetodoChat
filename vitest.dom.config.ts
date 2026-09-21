import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import base from "./vitest.config";

// A TERCEIRA CATEGORIA DE TESTE, e ela nasce pelo mesmo motivo que a segunda.
//
// `npm test` roda FUNÇÃO PURA: sem banco, sem rede, sem DOM — e essa regra é do
// dono. `vitest.integracao.config.ts` roda o que fala com Postgres. Faltava o
// que fala com o DOM, e a falta tinha preço medido: em 16/09/2026 reescrevi
// `app/contatos/selecao-client.tsx` de `useState` + dois `useEffect` para
// `useSyncExternalStore` — a marcação em lote, que o marketing usa — e NENHUM
// teste desta base tocou naquele arquivo. Os 1662 casos puros e os 207 de
// integração passariam idênticos se eu tivesse quebrado o contador, o
// "selecionar todas" ou o traço de indeterminado.
//
// -----------------------------------------------------------------------------
// O QUE ESTA CATEGORIA NÃO RESOLVE, escrito aqui para ninguém vender demais.
//
// Os DOIS defeitos de tela de 16/09 continuariam passando por aqui:
//
//   1. A FOTO VENCIDA que não virava inicial era TEMPO DE HIDRATAÇÃO — o evento
//      `error` disparava antes de o React pendurar o `onError`. jsdom não carrega
//      imagem, então aqui os estados teriam de ser forjados e o caso mediria o
//      predicado, não o navegador.
//   2. A SELEÇÃO QUE ENCOLHIA morava numa `key` dentro de um Server Component,
//      que jsdom não renderiza.
//
// Quem pega esses dois é `scripts/conferir-no-navegador.mjs`, contra o navegador
// de verdade. ESTA CATEGORIA É A OUTRA METADE: ela não acha o defeito daquele
// dia, ela impede que a próxima mexida na lógica deste componente seja tão cega
// quanto a minha foi.
//
// -----------------------------------------------------------------------------
// ELA ENTRA NO `verify`, e isso é decisão de desenho: roda offline, em
// milissegundos, e sem banco. A suíte de integração continua FORA porque exige
// Postgres, e um portão que só fecha com container de pé é um portão que se
// aprende a pular.
export default defineConfig({
  // O plugin do React é o que compila o JSX dos componentes de `app/`. A suíte
  // pura não precisa dele porque nunca importa componente.
  plugins: [react()],
  // Os mesmos atalhos das outras duas, importados e não copiados — três cópias
  // do alias de `server-only` acabariam divergindo, que é o defeito que esta
  // base persegue em toda parte.
  resolve: base.resolve,
  test: {
    environment: "jsdom",
    // DIRETÓRIO E SUFIXO PRÓPRIOS, a mesma dupla de travas da integração: o
    // `include` da suíte pura é `tests/**/*.test.ts`, e estes arquivos vivem
    // noutro diretório E terminam em `.dom.tsx`. Mesmo que um deles caísse
    // dentro de `tests/`, `npm test` continuaria sem enxergá-lo.
    include: ["testes-dom/**/*.dom.tsx"],
    // `cleanup()` do Testing Library entre casos: sem isto, a árvore de um caso
    // sobra no `document` do seguinte, e o componente deste arquivo alcança as
    // caixas por `document.getElementById` — ele veria o formulário do caso
    // anterior e mediria a tela errada.
    globals: true,
    setupFiles: ["testes-dom/limpeza.ts"],
  },
});
