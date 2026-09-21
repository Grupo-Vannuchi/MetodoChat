import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// A ÁRVORE DE UM CASO NÃO PODE SOBRAR NO SEGUINTE: os casos deste diretório
// montam formulários com o MESMO id, e `app/contatos/selecao-client.tsx`
// alcança as caixas por `document.getElementById(alvo)`, não pelas próprias
// props.
//
// E O DESFECHO SEM ISTO É BARULHENTO, e não silencioso — medido na revisão de
// 21/09/2026: sem a limpeza, 14 dos 15 casos ESTOURAM em `getByLabelText`
// ("Found multiple elements"). A primeira versão deste comentário dizia o
// contrário ("em silêncio e sem falhar"), o que vendia esta linha como defesa
// contra verde falso. Ela é conveniência: sem ela a suíte quebra, e alto.
afterEach(cleanup);
