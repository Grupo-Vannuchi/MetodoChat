import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O EDITOR DAS AUTOMAÇÕES NO CELULAR (docs/specs/2026-11-24-celular-onda-1.md, os achados 368 e 369): abaixo de
// 640 px, o quadro diz que a edição é pelo computador e esconde o Salvar. O teste monta o `Quadro` de verdade, e
// não um pedaço extraído dele: tirar o aviso do quadro tem de derrubar este teste.
//
// OS TRÊS DUBLÊS, e só eles:
// - a ação de servidor `salvarAutomacao`, que o quadro importa (`quadro.tsx:43`) e que aqui nunca é chamada;
// - o `ReactFlow`, trocado por um componente vazio, com o resto do `@xyflow/react` verdadeiro. O aviso e o Salvar
//   moram fora dele, e o quadro de arrastar não é o que este teste confere;
// - o `ResizeObserver`, que o jsdom não tem. O quadro o cria num efeito de montagem sobre a faixa de edição, que
//   fica fora do `ReactFlow` (`quadro.tsx:1187-1193` e `:1831`).
//
// O `vi.mock` sobe para o topo do arquivo, antes de qualquer `const`: a ação de mentira nasce no `vi.hoisted`, que
// sobe junto.
const { salvarAutomacao } = vi.hoisted(() => ({ salvarAutomacao: vi.fn() }));
vi.mock("@/app/automacoes/actions", () => ({ salvarAutomacao }));

vi.mock("@xyflow/react", async (importOriginal) => {
  const real = await importOriginal<typeof import("@xyflow/react")>();
  return { ...real, ReactFlow: () => null };
});

import Quadro from "@/app/automacoes/editor/quadro";
import type { Configuracao } from "@/app/automacoes/editor/painel";
import type { Passo } from "@/lib/steps";

const CONFIGURACAO: Configuracao = {
  nome: "automação de teste",
  ativo: false,
  gatilho: "dm",
  palavras: ["oi"],
  correspondencia: "contains",
  post: null,
  story: null,
  entregaSemPortao: false,
};

const PASSOS: Passo[] = [{ id: "b_dm0001", tipo: "dm", texto: "Oi! Aqui está o link." }];

function montarOQuadro() {
  render(
    <Quadro
      automationId="automacao-de-teste"
      passosIniciais={PASSOS}
      ligacoesIniciais={[]}
      configuracaoInicial={CONFIGURACAO}
      conta={{ usuario: "conta_de_teste", nome: null, foto: null }}
    />
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

// A CONFIG DE TELA NÃO DESFAZ O STUB SOZINHA (nem `vitest.dom.config.ts`, nem `testes-dom/limpeza.ts`), então ele se
// desfaz aqui, no molde de `testes-dom/bonus-capa-card.dom.tsx`.
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("o editor das automações no celular", () => {
  it("abaixo de 640 px, o quadro diz que a edição é pelo computador", () => {
    montarOQuadro();
    const aviso = screen.getByText(/A edição das automações é pelo computador/);
    expect(aviso.closest(".sm\\:hidden")).not.toBeNull();
  });

  it("o Salvar fica escondido abaixo de 640 px e só aparece de 640 px para cima", () => {
    montarOQuadro();
    const caixa = screen.getByRole("button", { name: "Salvar automação" }).closest(".sm\\:flex");
    expect(caixa).not.toBeNull();
    expect(caixa?.classList.contains("hidden")).toBe(true);
  });
});
