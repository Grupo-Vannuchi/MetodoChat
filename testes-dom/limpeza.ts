import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// A ÁRVORE DE UM CASO NÃO PODE SOBRAR NO SEGUINTE, e aqui isso é mais grave do
// que o normal: `app/contatos/selecao-client.tsx` alcança as caixas por
// `document.getElementById(alvo)`, e não pelas próprias props. Sem esta
// limpeza, um caso veria o formulário do caso anterior — com o MESMO id — e
// mediria a tela errada, em silêncio e sem falhar.
afterEach(cleanup);
