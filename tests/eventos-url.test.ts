import { describe, it, expect } from "vitest";
import {
  aplicarMudanca,
  queryDaPagina,
  SEM_FILTROS,
  type FiltrosDaPagina,
} from "@/lib/eventos-url";
import { parseFilters, NO_FILTERS } from "@/lib/event-filters";
import { parseEnvioFilters, NO_ENVIO_FILTERS } from "@/lib/envio-filters";

// Estas duas funções são o dono da barra de endereço de /eventos. Elas
// substituíram o par "cada barra monta a sua metade + carrega um retrato da
// outra", que perdia atualização.

describe("queryDaPagina", () => {
  it("sem filtro nenhum, a URL fica nua", () => {
    expect(queryDaPagina(SEM_FILTROS)).toBe("");
  });

  it("só com filtro de interações, não inventa parâmetro de envio", () => {
    const f: FiltrosDaPagina = {
      eventos: { ...NO_FILTERS, period: "7d", q: "oi" },
      envios: NO_ENVIO_FILTERS,
    };
    expect(queryDaPagina(f)).toBe("periodo=7d&q=oi");
  });

  it("só com filtro de envios, não inventa parâmetro de interação", () => {
    const f: FiltrosDaPagina = {
      eventos: NO_FILTERS,
      envios: { ...NO_ENVIO_FILTERS, origem: "voce" },
    };
    expect(queryDaPagina(f)).toBe("envios_origem=voce");
  });

  it("com os dois, junta na ordem fixa: interações e depois envios", () => {
    const f: FiltrosDaPagina = {
      eventos: { ...NO_FILTERS, period: "7d", q: "oi" },
      envios: { ...NO_ENVIO_FILTERS, period: "24h", origem: "voce", situacao: "failed" },
    };
    expect(queryDaPagina(f)).toBe(
      "periodo=7d&q=oi&envios_periodo=24h&envios_origem=voce&envios_situacao=failed"
    );
  });

  // A ida e a volta têm que fechar: o que a página escreve na URL é exatamente o
  // que ela lê de volta no próximo render.
  it("o que é escrito é o que o servidor lê de volta", () => {
    const f: FiltrosDaPagina = {
      eventos: { post: "17900000000000000", type: "comment", period: "30d", q: "@ana" },
      envios: { period: "24h", origem: "robo", situacao: "pending" },
    };
    const params = Object.fromEntries(new URLSearchParams(queryDaPagina(f)));
    expect({ eventos: parseFilters(params), envios: parseEnvioFilters(params) }).toEqual(f);
  });
});

describe("aplicarMudanca", () => {
  const partida: FiltrosDaPagina = {
    eventos: { ...NO_FILTERS, q: "promo" },
    envios: { ...NO_ENVIO_FILTERS, situacao: "failed" },
  };

  it("mexer numa seção não encosta na outra", () => {
    const depois = aplicarMudanca(partida, { secao: "eventos", mudanca: { period: "7d" } });
    expect(depois.eventos).toEqual({ ...NO_FILTERS, q: "promo", period: "7d" });
    expect(depois.envios).toEqual(partida.envios);
  });

  it("não altera o objeto recebido", () => {
    aplicarMudanca(partida, { secao: "envios", mudanca: { origem: "voce" } });
    expect(partida.envios.origem).toBeNull();
  });

  // Este é o teste da corrida. Duas mudanças em seções diferentes, uma em cima
  // da outra: as duas sobrevivem, e a query final tem as duas. Era exatamente
  // isto que se perdia quando cada barra montava o endereço a partir de um
  // retrato da outra tirado antes da primeira mudança.
  it("duas mudanças seguidas em seções diferentes sobrevivem juntas", () => {
    const primeira = aplicarMudanca(SEM_FILTROS, { secao: "envios", mudanca: { origem: "voce" } });
    const segunda = aplicarMudanca(primeira, { secao: "eventos", mudanca: { period: "7d" } });
    expect(queryDaPagina(segunda)).toBe("periodo=7d&envios_origem=voce");
  });

  // O estado otimista reaplica as mudanças ainda pendentes sobre o estado novo
  // que vem do servidor. Se a mudança não fosse absoluta, esse reaplicar
  // andaria duas casas.
  it("aplicar a mesma mudança de novo dá no mesmo", () => {
    const uma = aplicarMudanca(partida, { secao: "eventos", mudanca: { period: "24h" } });
    const duas = aplicarMudanca(uma, { secao: "eventos", mudanca: { period: "24h" } });
    expect(duas).toEqual(uma);
  });

  it("limpar uma seção inteira não limpa a outra", () => {
    const depois = aplicarMudanca(partida, { secao: "eventos", mudanca: NO_FILTERS });
    expect(queryDaPagina(depois)).toBe("envios_situacao=failed");
  });
});
