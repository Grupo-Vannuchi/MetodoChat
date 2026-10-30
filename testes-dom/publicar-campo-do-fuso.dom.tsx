import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CampoDoFuso from "@/app/publicar/campo-do-fuso";

// O FUSO DO REMARCAR (spec 2026-10-19-enquadrar-imagens, achado 121). A tela de remarcar é de servidor, e o
// fuso vinha de um campo escondido com `defaultValue` vazio, preenchido por um `<Script>` de id fixo. Uma sonda
// mediu em 19/10, no `next dev` e no `next start`, com o fuso de Manaus: o post aberto por carga inteira
// mandava "240", e o segundo post aberto por Link, como do calendário, mandava vazio, porque o `<Script>` de
// mesmo id só roda uma vez por documento. O campo agora é de cliente, e estes casos cobram que ele tem o fuso
// ao montar, depois de um novo desenho e no segundo formulário da mesma aba. A hidratação, que o jsdom não
// faz, foi medida pela mesma sonda com o campo novo no lugar (27/10, `next start` do 16.4.3): todo post manda
// "240", também o segundo aberto por Link.

const formulario = () => (
  <form>
    <CampoDoFuso name="fuso" />
  </form>
);
const lido = (raiz: HTMLElement) => new FormData(raiz.querySelector("form")!).get("fuso");
const doNavegador = () => String(new Date().getTimezoneOffset());

describe("o campo do fuso", () => {
  it("nasce com o fuso do navegador", () => {
    const { container } = render(formulario());
    expect(lido(container)).toBe(doNavegador());
  });

  // UMA ACTION QUE VOLTA À PÁGINA, OU UM `router.refresh`, desenha a página de novo com as mesmas
  // propriedades. Era esse desenho que devolvia o campo de `defaultValue` ao valor inicial vazio.
  it("continua com ele quando a página é desenhada de novo", () => {
    const { container, rerender } = render(formulario());
    rerender(formulario());
    rerender(formulario());
    expect(lido(container)).toBe(doNavegador());
  });

  it("o segundo formulário montado na mesma aba também tem o fuso, como o segundo post aberto por Link", () => {
    render(formulario()).unmount();
    const { container } = render(formulario());
    expect(lido(container)).toBe(doNavegador());
  });
});
