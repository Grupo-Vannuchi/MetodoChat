import { peneirar, urlDaExportacao, type Recorte } from "@/lib/exportacao-de-contatos";
import type { ContatoBuscavel } from "@/lib/busca-de-contatos";
import { btnGhost, muted } from "../ui";

// A FAIXA DE "EXPORTAR TODOS OS DADOS" — a frase e o botão, num componente só.
//
// POR QUE ELA SAIU DE `page.tsx`: para o teste de DOM alcançar a faixa sem
// montar a página inteira. `ContatosPage` é `async`, consulta o Postgres e lê a
// conta selecionada — `testes-dom/` roda offline, em jsdom, sem banco —, e as
// duas rotas de exportação começam em `isValidSession`, que teste nenhum desta
// base atravessa. Era esse o buraco: a regra mais importante desta tela não
// tinha rede DO LADO DA TELA, e a revisão de 23/09/2026 provou plantando o
// defeito de 11/09/2026 aqui dentro — ele passou por `tsc`, `eslint`, 1804
// casos puros e 39 de DOM.
//
// É O QUE OS CASOS DO EDITOR JÁ TINHAM DE GRAÇA, e vale dizer a diferença em
// vez de vendê-la como precedente: `painel.tsx` e `previa.tsx` já eram
// componentes próprios, e por isso `testes-dom/campo-livre.dom.tsx` e os outros
// dois conseguem montá-los. Aqui a faixa morava dentro de uma página `async`
// que consulta o banco — e um fragmento nessa posição não tem como ser montado
// por caso nenhum. Extrair é o que lhe dá a mesma alcançabilidade; é a única
// coisa que saiu de `page.tsx`, e a posição dela na página continua sendo
// decidida lá.
//
// A REGRA QUE ELA CARREGA: A FRASE E O BOTÃO NÃO PODEM DISCORDAR SOBRE O MESMO
// CLIQUE. Em 11/09/2026 discordaram — a tela dizia "1 pessoa" e o botão baixava
// 40 —, e o que impede a volta disso é ter UM `Recorte` só aqui dentro: o
// número da frase sai de `peneirar(contatos, recorte)` e o endereço do botão
// sai de `urlDaExportacao(…, recorte)`. Não há um segundo número para passar
// por engano, e não há um segundo lugar de onde o link possa sair.
//
// O QUE ELA NÃO DECIDE: ONDE ela fica na página. Isso continua sendo de
// `page.tsx` — o comentário de lá explica por que ela mora entre o bloco de
// envio e as duas tabelas, e não dentro da seção "Com e-mail".

/**
 * O que a faixa precisa de cada contato: exatamente o que as DUAS peneiras
 * leem. `ContatoBuscavel` é o que `casaComBusca` procura (o @, o nome e o
 * e-mail) e `categoria` é por onde `contatosDoFiltro` peneira — nada além
 * disso, para que um caso possa montar a faixa com gente de mentira sem
 * precisar de uma linha inteira do banco.
 */
export type ContatoDaFaixa = ContatoBuscavel & { categoria: string | null };

/**
 * A faixa recebe o conjunto de ANTES das duas peneiras, e as aplica ela mesma.
 *
 * RECEBER O NÚMERO PRONTO SERIA O DEFEITO: bastaria a página passar o conjunto
 * errado — `visiveis` no lugar de `achados`, que é literalmente o 11/09 — e a
 * frase voltaria a contar gente que o arquivo não traz, sem nada acusando. Com
 * o conjunto cru e o recorte, o número é DERIVADO do mesmo objeto que o link
 * carrega, e `testes-dom/faixa-da-exportacao.dom.tsx` afirma isso lendo o link
 * como a rota o lê.
 *
 * ELA SÓ É RENDERIZADA COM GENTE NO RECORTE (`achados.length > 0`, em
 * `page.tsx`): os dois vazios — busca sem resultado e filtro sem ninguém — têm
 * tela própria, com texto que explica o que fazer, nos ramos acima dela.
 */
export function FaixaDaExportacaoCompleta({
  contatos,
  recorte,
}: {
  contatos: ContatoDaFaixa[];
  recorte: Recorte;
}) {
  const doRecorte = peneirar(contatos, recorte);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className={`text-sm ${muted}`}>
        {doRecorte.length} {doRecorte.length === 1 ? "pessoa" : "pessoas"} neste recorte — com
        e-mail ou sem, com tudo que as automações já coletaram
      </p>
      <a
        href={urlDaExportacao("/api/contatos/csv-completo", recorte)}
        className={btnGhost}
        download
      >
        Exportar todos os dados
      </a>
    </div>
  );
}
