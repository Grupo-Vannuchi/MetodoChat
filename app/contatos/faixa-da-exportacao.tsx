import {
  urlDaExportacao,
  type ContatoDaTela,
  type TelaDeContatos,
} from "@/lib/exportacao-de-contatos";
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
// 40 —, e o que impede a volta disso é a frase e o link saírem do MESMO objeto:
// o número é `tela.achados`, o endereço é `urlDaExportacao(…, tela.recorte)`, e
// os dois campos foram derivados juntos por `recortarTela`.
//
// O QUE ELA NÃO DECIDE: ONDE ela fica na página. Isso continua sendo de
// `page.tsx` — o comentário de lá explica por que ela mora entre o bloco de
// envio e as duas tabelas, e não dentro da seção "Com e-mail".

/**
 * A faixa recebe A TELA RECORTADA INTEIRA, e não um conjunto solto.
 *
 * A PRIMEIRA VERSÃO RECEBIA O CONJUNTO CRU MAIS O `Recorte`, e derivava o
 * número aqui dentro. Isso fechava a discordância entre a frase e o botão, mas
 * TROCAVA "passar o número errado" por "passar o CONJUNTO errado" — e só o
 * primeiro tinha rede. Medido em 24/09/2026: na página havia quatro conjuntos
 * do mesmo tipo, e `contatos={comEmail}` no lugar de `contatos={rows}` — com
 * `comEmail` duas linhas acima, alimentando a tabela logo abaixo desta faixa —
 * atravessou `tsc`, `eslint`, 1808 casos puros e 47 de DOM. A frase passava a
 * contar só quem tem e-mail, o botão continuava baixando todo mundo.
 *
 * COM O OBJETO NÃO HÁ O QUE ESCOLHER. `recortarTela` é quem produz um
 * `TelaDeContatos`, e ele já traz o recorte E os conjuntos derivados dele
 * juntos: não existe um segundo conjunto para entregar por engano, nem um
 * `Recorte` solto para montar de novo no JSX.
 *
 * O QUE CONTINUA SEM REDE, escrito aqui para o comentário não prometer mais do
 * que o código faz. DUAS formas passaram na medição de 24/09/2026, e as duas
 * exigem escrever código novo de propósito — não são erro de distração:
 *
 *   1. ADULTERAR o objeto na passagem: `{...tela, achados: tela.comEmail}`.
 *      `tsc` aceita, e marca opaca não resolveria — o espalhamento copiaria a
 *      marca junto.
 *   2. DERIVAR UM SEGUNDO objeto no JSX: `tela={recortarTela(rows, filtro,
 *      null)}`. Aqui a frase e o botão continuam de acordo ENTRE SI (os dois
 *      saem do mesmo recorte), então a regra que esta faixa carrega não é
 *      quebrada; o que discorda é a faixa contra as duas tabelas abaixo dela.
 *      É defeito mais fraco que o de 11/09, e nenhum caso o acusa.
 *
 * O desenho fecha o erro por ENGANO — entregar o conjunto vizinho —, que é a
 * forma que esta tela já viu duas vezes.
 *
 * O QUE `testes-dom/faixa-da-exportacao.dom.tsx` AFIRMA: que o número da frase
 * e as pessoas que o `href` traz são o mesmo conjunto — lendo o link como a
 * ROTA o lê (`recorteDaUrl`) e aplicando as MESMAS peneiras (`peneirar`).
 *
 * ELA SÓ É RENDERIZADA COM GENTE NO RECORTE (`achados.length > 0`, em
 * `page.tsx`): os dois vazios — busca sem resultado e filtro sem ninguém — têm
 * tela própria, com texto que explica o que fazer, nos ramos acima dela.
 */
export function FaixaDaExportacaoCompleta({ tela }: { tela: TelaDeContatos<ContatoDaTela> }) {
  const { achados, recorte } = tela;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className={`text-sm ${muted}`}>
        {achados.length} {achados.length === 1 ? "pessoa" : "pessoas"} neste recorte — com
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
