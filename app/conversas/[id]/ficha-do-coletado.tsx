import { fmtDate } from "@/lib/format";
import type { ItemDaFicha } from "@/lib/ficha-do-coletado";
import { muted, numero } from "../../ui";

// A FICHA DO QUE AS AUTOMAÇÕES COLETARAM — a faixa logo abaixo do cabeçalho da
// conversa.
//
// POR QUE ELA SAIU DE `page.tsx`: para o teste de DOM alcançá-la sem montar a
// página inteira. `ConversaPage` é `async`, consulta o Postgres e lê a conta
// selecionada — `testes-dom/` roda offline, em jsdom, sem banco —, e um
// fragmento nessa posição não tem como ser montado por caso nenhum. É o mesmo
// movimento, e o mesmo motivo, de `app/contatos/faixa-da-exportacao.tsx`: leia o
// cabeçalho daquele arquivo para o preço medido de não o ter feito antes.
//
// O QUE ELA NÃO DECIDE: QUAIS campos aparecem, em que ordem, com que rótulo e se
// a data é real. Isso é de `fichaDoColetado` (lib/ficha-do-coletado.ts), que é
// puro e tem caso. Aqui só se decide o que a pessoa LÊ.
//
// ELA RECEBE OS ITENS JÁ DERIVADOS, e não o contato cru, pela mesma razão da
// faixa da exportação: a página não fica com nenhuma escolha na mão — não existe
// um segundo conjunto para entregar por engano.
//
// POR QUE SOMENTE LEITURA: a edição é escopo de outro dia, por decisão do dono.
// Um campo editável aqui precisaria de uma ação de servidor, de validação pelo
// extrator do catálogo e de uma resposta à pergunta "quem editou, e quando?" —
// que é justamente a pergunta que a coluna `em` guarda hoje sobre a COLETA.

// O QUE A LINHA DO "QUANDO" DIZ, e por que ela tem dois desfechos.
//
// `em: null` NÃO É "faltou consultar": é "este dado está aqui e não se sabe
// quando chegou". Quem produz o `null` é `instanteDaColeta`
// (lib/ficha-do-coletado.ts), e o comentário dela explica o discriminador — a
// ausência da chave `automacao`, que separa o registro escrito por
// `gravarCampo` (lib/engine.ts) do que a migração `012` moveu da coluna
// `contacts.email`.
//
// NOVE CONTATOS EM PRODUÇÃO ESTÃO NESSE CASO, e é por eles que esta função não
// tem um terceiro ramo esperto: o `em` deles existe e aponta para o instante em
// que a migração rodou. Escrever "coletado em 24/09" ao lado desses e-mails
// seria inventar uma medição que ninguém fez — e seria a sexta tela desta
// funcionalidade a afirmar o contrário da verdade.
//
// A FRASE É GENÉRICA DE PROPÓSITO ("sem data de coleta", e não "veio do cadastro
// antigo"): a regra é sobre a AUSÊNCIA da chave `automacao`, que vale para
// qualquer campo, e só o e-mail tem cadastro antigo de onde vir. Um dia em que
// outro campo chegue sem essa chave, a frase continua verdadeira.
function quandoEmProsa(em: string | null): string {
  return em === null ? "sem data de coleta" : `coletado em ${fmtDate(em)}`;
}

// A FRASE DO VAZIO, e ela existe porque o silêncio aqui seria indistinguível do
// defeito que esta tela veio consertar: até hoje o dado coletado não aparecia em
// tela nenhuma do painel, e quem procurasse o telefone que a automação pediu não
// tinha como saber se ele não fora coletado ou se o painel é que não o mostrava.
// Uma caixa vazia diria menos ainda.
//
// ELA NÃO LISTA OS CAMPOS DO CATÁLOGO, e a recusa é medida: `camposDoSistemaEmProsa`
// (lib/campos.ts) escreveria "e-mail, telefone / whatsapp, nome informado ou data
// de nascimento" — quatro nomes que deixariam de fora justamente os campos
// LIVRES, que também caem aqui e que são os que o marketing nomeia. Uma lista
// incompleta prometeria menos do que a ficha mostra.
const NADA_COLETADO =
  "Nada coletado ainda — quando uma automação pedir um dado a esta pessoa, a resposta aparece aqui.";

// A FAIXA REPETE A BORDA DO CABEÇALHO desta coluna (`border-zinc-200/80` /
// `dark:border-zinc-800`), e não o `traco` da paleta: o que ela precisa é
// parecer a segunda linha do mesmo cabeçalho, e é com o vizinho de cima que ela
// tem de combinar.
const FAIXA = "border-b border-zinc-200/80 px-4 py-2.5 dark:border-zinc-800";

export function FichaDoColetado({ itens }: { itens: ItemDaFicha[] }) {
  if (itens.length === 0) {
    return (
      <div className={FAIXA}>
        <p className={`text-xs ${muted}`}>{NADA_COLETADO}</p>
      </div>
    );
  }

  return (
    <div className={FAIXA}>
      {/* `<dl>` E NÃO UMA TABELA: são pares nome-valor, que é literalmente o que
          uma lista de definição é — e quem usa leitor de tela ouve o rótulo
          ligado ao valor sem que a tela precise repetir nada.

          `flex-wrap` porque o número de campos é do marketing, não desta tela:
          quatro do catálogo mais quantos campos livres ele tiver nomeado. A
          faixa cresce para baixo, e quem cede o espaço é a área das mensagens,
          que é a única com `flex-1` nesta coluna. */}
      <dl className="flex flex-wrap items-start gap-x-6 gap-y-2">
        {itens.map((item) => (
          <div key={item.chave} className="min-w-0 max-w-full">
            <dt className={`text-[11px] ${muted}`}>{item.rotulo}</dt>
            {/* `truncate` porque valor coletado é texto de gente: um campo livre
                pode ter vindo com uma frase inteira, e ela não pode empurrar o
                resto da ficha para fora. O `title` dá o valor completo a quem
                precisar dele — e o texto continua inteiro no DOM, que é o que a
                seleção e a cópia usam. */}
            <dd className="truncate text-sm" title={item.valor}>
              {item.valor}
            </dd>
            {/* `numero` (IBM Plex Mono, dígitos tabulares) é o token desta base
                para tempo — a mesma família da hora das mensagens ao lado. */}
            <dd className={`text-[11px] ${numero} ${muted}`}>{quandoEmProsa(item.em)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
