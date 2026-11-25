// A MARCA DO PAINEL NUM LUGAR SÓ (docs/specs/2026-11-24-celular-onda-1.md, o achado 343).
//
// O nome e a descrição saem daqui para o <head> de toda página (o `metadata` de app/layout.tsx) e para o
// manifesto do celular (app/manifest.ts). Com dois textos, um mudaria e o outro não, e o ícone da tela inicial e a
// aba do navegador passariam a dizer coisas diferentes. tests/manifesto.test.ts confere que os dois usam estas
// constantes.
//
// AS TRÊS CORES SÃO AS DO SISTEMA (app/globals.css): o papel (`--color-papel`, :54), o fundo do tema escuro
// (`--color-papel-escuro`, :58) e a ação no tema escuro (`--color-acao-escuro`, :104). O manifesto, a barra do
// celular e o ícone não leem o CSS, então os valores vão escritos aqui. Se o sistema mudar de cor, estas mudam
// junto. O ícone e a barra ficaram no preto do painel, com o ponto no azul claro, pela decisão do Victor de
// 25/11, depois de ver o ícone no azul (docs/specs/2026-11-24-celular-onda-1.md).
export const NOME_DO_PAINEL = "MetodoChat";
export const TITULO_DO_PAINEL = "MetodoChat — comentário vira DM";
export const DESCRICAO_DO_PAINEL = "Automação do seu Instagram: palavra-chave no comentário vira DM com seu link.";
export const COR_DO_PAPEL = "#fbfaf8";
export const COR_DO_PAPEL_ESCURO = "#0b0a0e";
export const COR_DA_ACAO_ESCURA = "#78bacd";
