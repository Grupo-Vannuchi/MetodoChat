import { describe, expect, it, vi } from "vitest";
import { fotoDaCapa, memoriaDasFotos } from "@/lib/bonus/arte-foto";

// A IMAGEM DA CAPA, BUSCADA PELA ROTA DA ARTE (spec da Etapa 11): a mesma busca, as mesmas travas e a mesma
// memória da foto do espaço (tests/bonus-arte-foto.test.ts), só no caminho exato
// `<pasta da conta do carrossel>/bonus-capa/<uuid>.jpg`. O caminho vem da coluna `arte`, gravado pelo
// servidor que o assinou; mesmo assim, nenhum outro caminho é buscado.

const CONTA = "17841400000000001";
const UUID = "0f8e2a4b-1c3d-4e5f-8a9b-0c1d2e3f4a5b";
const CAMINHO = `${CONTA}/bonus-capa/${UUID}.jpg`;

describe("a imagem da capa", () => {
  it("o caminho exato da capa, na pasta da conta do carrossel, passa pela memória", async () => {
    const buscar = vi.fn(async () => "data:image/jpeg;base64,/9j/");
    expect(await fotoDaCapa(CAMINHO, CONTA, memoriaDasFotos(buscar))).toBe("data:image/jpeg;base64,/9j/");
    expect(buscar).toHaveBeenCalledWith(CAMINHO);
  });

  it.each([
    ["a foto do espaço, de bonus-foto/", `${CONTA}/bonus-foto/${UUID}.jpg`, CONTA],
    ["o slide pronto, de bonus/", `${CONTA}/bonus/${UUID}.jpg`, CONTA],
    ["a arte da fila", `${CONTA}/bonus-fila/${UUID}.jpg`, CONTA],
    ["a capa de outra conta", `17841400000000002/bonus-capa/${UUID}.jpg`, CONTA],
    ["subir de pasta", `${CONTA}/bonus-capa/../../outra/${UUID}.jpg`, CONTA],
    ["outro host, no lugar do caminho", "https://exemplo.com/capa.jpg", CONTA],
    ["o carrossel sem conta", CAMINHO, null],
  ])("recusa como capa %s, sem buscar", async (_nome, caminho, conta) => {
    const buscar = vi.fn(async () => "data:image/jpeg;base64,/9j/");
    expect(await fotoDaCapa(caminho, conta, memoriaDasFotos(buscar))).toBeNull();
    expect(buscar).not.toHaveBeenCalled();
  });
});
