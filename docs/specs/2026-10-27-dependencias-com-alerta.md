# As dependências da produção sem alerta de segurança

**Nascido em:** 27/10/2026, sobre a `main` em `eb2d12a`, do item 4 da varredura de segurança de 26/10.
**Decisão do Eduardo pela caixa, em 27/10:** "Atualizar o Next.js".

---

## O que foi medido

`npm audit` na `main`, em 27/10, deu 12 alertas. Destes, 5 estão no que vai para a produção
(`npm audit --omit=dev`):

| Pacote | Gravidade | Faixa com o alerta | Correção |
|---|---|---|---|
| `next` 16.3.8 | crítico | 16.0.0 a 16.4.0 | 16.4.3 |
| `zod` 4.4.3 | alto | abaixo de 4.6.6 | 4.6.7 |
| `nanoid` 3.3.16 | alto | abaixo de 3.3.18 | 3.3.20, dentro da faixa já permitida |
| `source-map-js` 1.2.1 | alto | 1.0.0 a 1.2.1 | 1.2.2, dentro da faixa já permitida |
| `baseline-browser-mapping` 2.10.43 | médio | 2.0.0 a 2.10.x | 2.11.33, dentro da faixa já permitida |

**Os alertas do Next:**
- GHSA-2464-fhr4-w9xw (execução remota de código na otimização de imagem com SVG);
- GHSA-673q-mjm6-r5xr (execução remota de código em `use cache`);
- GHSA-p3m5-59mp-jv5r (negação de serviço com Server Actions).

A varredura de 26/10 mediu o risco real como baixo: a otimização de imagem é servida pela Vercel, e o projeto não usa
`use cache`. A correção está na 16.4.1, e a 16.4.3 é de 23/10.

**Os outros 7 alertas** são só de ferramentas de teste e de build (vitest, vite, `@vitest/mocker`,
brace-expansion, browserslist, js-yaml e undici). Ficam para outro PR, porque mexer neles pode mudar o
comportamento dos próprios testes.

## O que muda

- **`package.json`:** `next` e `eslint-config-next` vão de 16.3.8 para 16.4.3 (versão exata, como já era), e
  `zod` vai de `^4.4.3` para `^4.6.7`.
- **`package-lock.json`:** o reflexo disso, mais `nanoid`, `source-map-js` e `baseline-browser-mapping`
  atualizados dentro das faixas que os pacotes já permitiam (`npm update` só deles). O React fica em 19.2.4.
- **`testes-integracao/semear-requisicao.ts`:** o construtor do cache incremental do Next mudou na 16.4.
  - Até a 16.3, ele recebia `getPrerenderManifest`, uma função.
  - Na 16.4, ele recebe `prerenderManifest` (o objeto) e `previewProps`, e lê `previewProps.previewModeId`
    logo no começo.
  - Com o formato antigo, todo contexto semeado estourava, e 157 casos de integração caíram.
  - O simulador passa a usar o formato novo. A peça continua sendo a de verdade, e nenhuma imitação entra.

## O que não muda

Nenhum arquivo do painel (`app/`, `lib/`, `proxy.ts`). Não há migração.

As notas da 16.4.0 a 16.4.3 só trazem mudanças internas, os três alertas (na 16.4.1) e uma melhora no
`proxy.ts` (na 16.4.3). Os guias do próprio Next instalado (`node_modules/next/dist/docs`) só citam a 16.4 em
duas coisas que não afetam o painel:
- o `agentRules`, que vale só no `next dev`;
- o suporte a ESLint 10 no `eslint-config-next`.

## Medido com a atualização

- `npm audit --omit=dev`: 0 alertas. Sem o filtro, sobram os 7 das ferramentas.
- O `next build` (sem o passo de migração e sem banco) passa: "Next.js 16.4.3", "Compiled successfully" e as
  14 páginas, com o proxy.
- Lint e `tsc` limpos; puros 123/3332; tela 25/220; varredura sem vazamento.
- Integração no container: antes do ajuste no simulador, 157 casos caíram; depois dele, 50 arquivos, 566
  casos passando e 8 pulados, igual à `main`.

## A prova, no preview

Sem gravar nada além do login:
- o painel abre;
- as telas principais carregam (Início, Conversas, Automações, Publicações e Configuração);
- uma automação abre no editor.

Nenhum botão que grava é clicado.
