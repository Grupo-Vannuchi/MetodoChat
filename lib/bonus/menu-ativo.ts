// O ITEM MARCADO NO MENU (spec da Etapa 10, adendo de 13/10). PURO, com teste: o menu (app/app-shell.tsx)
// pergunta aqui, para cada item, se ele é o da página aberta.
//
// O CARROSSEL DE BÔNUS mora embaixo do bônus (`/bonus/<id>/carrossel/<cid>`, carrossel-caminho.ts), mas é
// do menu "Carrosséis", como o avulso: quem entra nele pela lista não está no "Bônus" (decisão do Eduardo
// em 13/10). O segmento conta inteiro: `/bonus/<id>/carrosselX` não é carrossel. Todo o resto fica como
// era: "/" só na raiz, e os outros itens pelo começo do endereço.

const CARROSSEL_DE_BONUS = /^\/bonus\/[^/]+\/carrossel(\/|$)/;

export function itemDoMenuAtivo(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (CARROSSEL_DE_BONUS.test(pathname)) return href === "/carrosseis";
  return pathname.startsWith(href);
}
