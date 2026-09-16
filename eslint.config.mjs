import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // O SUBLINHADO JÁ SIGNIFICAVA "NÃO USO DE PROPÓSITO" NESTA BASE, e a regra
    // não sabia disso. `createServer((_req, _res) => {})` em
    // `testes-integracao/teto-da-meta.integracao.ts` é o caso exemplar: o
    // servidor de teste existe para ACEITAR a conexão e NUNCA responder, então
    // não tocar em `_res` é a coisa toda que ele faz. Sem esta configuração, o
    // jeito certo de escrever aquilo gerava aviso, e aviso que ninguém pode
    // resolver é aviso que ensina a ignorar a lista inteira.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
