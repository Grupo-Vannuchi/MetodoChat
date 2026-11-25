// A MARCA DO PAINEL NUM LUGAR SÓ (docs/specs/2026-11-24-celular-onda-1.md, o achado 343).
//
// O nome e a descrição saem daqui para o <head> de toda página (o `metadata` de app/layout.tsx) e para o
// manifesto do celular (app/manifest.ts). Com dois textos, um mudaria e o outro não, e o ícone da tela inicial e a
// aba do navegador passariam a dizer coisas diferentes. tests/manifesto.test.ts confere que os dois usam estas
// constantes.
//
// AS DUAS CORES SÃO AS DO SISTEMA (app/globals.css): o papel (`--color-papel`, :54) e a ação (`--color-acao`,
// :102). O manifesto e a barra do celular não leem o CSS, então os valores vão escritos aqui. Se o sistema mudar
// de cor, estas mudam junto.
export const NOME_DO_PAINEL = "MetodoChat";
export const TITULO_DO_PAINEL = "MetodoChat — comentário vira DM";
export const DESCRICAO_DO_PAINEL = "Automação do seu Instagram: palavra-chave no comentário vira DM com seu link.";
export const COR_DO_PAPEL = "#fbfaf8";
export const COR_DA_ACAO = "#1a5a6c";
