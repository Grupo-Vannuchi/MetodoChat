import { card, muted, numero, tendenciaSobe, tendenciaCai } from "./ui";
import { indiceDoPico } from "@/lib/calendario";

// Peças visuais do painel, separadas da busca de dados: recebem tudo por
// props, o que deixa cada uma fácil de conferir isoladamente.

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  trend,
}: {
  icon: (p: { className?: string }) => React.ReactNode;
  label: string;
  value: number;
  hint?: string;
  trend?: number;
}) {
  return (
    <div className={`p-4 ${card}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-medium ${muted}`}>{label}</p>
        {/* O ÍCONE USA O TOKEN NOMEADO, e não `zinc` cru. Medido por revisão em
            11/09/2026: `text-zinc-400`/`dark:text-zinc-600` dava 2,62:1 no
            cartão claro e 2,38:1 no escuro — abaixo dos 3:1 que a WCAG pede
            para elemento gráfico. Ele escapava dos três portões porque
            `texto-quieto` só varre os tokens de `app/ui.ts`, `paleta` só bane
            índigo e `escala` só olha tamanho e raio. */}
        <Icon className="h-4 w-4 shrink-0 text-quieto dark:text-quieto-escuro" />
      </div>
      <p className={`mt-2 text-3xl font-bold leading-none ${numero}`}>{value}</p>
      {/* O ACHADO D7, E ELE ERA DOIS DEFEITOS NUMA LINHA.
      
          O PRIMEIRO, DE CONTRASTE: a subida usava `emerald-600`, que dá 3,65:1
          sobre o cartão branco — abaixo do mínimo de 4,5:1. A auditoria não o
          consertou na Onda 3 e escreveu por quê: `emerald-600` era o verde de
          sucesso do sistema inteiro, e trocá-lo num lugar só criaria um SEGUNDO
          verde. Agora existe `aberto` (#15803D), que É o verde do sistema e
          mede 4,56:1 — usar o token não inventa cor nenhuma, e passa.

          O SEGUNDO, DE HIERARQUIA: a queda tinha exatamente a cor do texto ao
          lado (os dois em `muted`), então "↓ 23" e "vs. 7 dias antes" liam como
          uma frase só e o número perdia estatuto de número. A assimetria de COR
          continua de propósito — queda não é falha, e vermelho alarmaria sobre
          algo que não quebrou —, mas o número passa a usar `numero` (a tabular)
          e a tinta normal, e a legenda continua quieta. O que separa os dois
          agora é peso e família, não matiz. */}
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        {trend !== undefined && trend !== 0 && (
          <span
            className={trend > 0 ? tendenciaSobe : tendenciaCai}
          >
            {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}
          </span>
        )}
        {hint && <span className={`truncate ${muted}`}>{hint}</span>}
      </div>
    </div>
  );
}

export type Dia = { chave: string; rotulo: string; n: number };

export function SentChart({ dias }: { dias: Dia[] }) {
  const max = Math.max(...dias.map((d) => d.n), 0);
  const total = dias.reduce((soma, d) => soma + d.n, 0);
  // QUAL BARRA LEVA O NÚMERO — decisão pura, com teste. Era `d.n === max`
  // escrito no JSX, e numa série chata isso rótula quase tudo: medido, 12 de 14
  // barras numa série de doze dias com uma mensagem cada.
  const pico = indiceDoPico(dias.map((d) => d.n));

  return (
    <section className={`p-5 ${card}`}>
      <div className="mb-5 flex items-baseline justify-between gap-2">
        <h2 className="titulo text-sm font-semibold">Mensagens por dia</h2>
        <span className={`text-xs ${muted}`}>
          <span className={numero}>{total}</span> em {dias.length} dias
        </span>
      </div>
      {max === 0 ? (
        <p className={`py-10 text-center text-sm ${muted}`}>
          Nenhuma mensagem enviada ainda nesse período.
        </p>
      ) : (
        // O EIXO E O VALOR, que é o achado da auditoria sobre este gráfico:
        // "dá para ver a forma, não a grandeza". Sem uma referência numérica,
        // uma barra alta pode ser 3 mensagens ou 300, e o gráfico vira
        // decoração com aparência de informação.
        //
        // SÃO DUAS LINHAS SÓ — o máximo e a metade. Uma grade de cinco linhas
        // numa faixa de 14 dias diz menos do que atrapalha; estas duas dão a
        // escala e param.
        <div className="flex gap-3">
          <div
            className={`flex h-32 w-8 shrink-0 flex-col justify-between text-right text-[11px] ${numero} ${muted}`}
          >
            <span>{max}</span>
            <span>{Math.round(max / 2)}</span>
            <span>0</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative h-32">
              {/* as duas linhas do eixo, atrás das barras */}
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 border-t border-traco dark:border-traco-escuro"
              />
              <span
                aria-hidden
                className="absolute inset-x-0 top-1/2 border-t border-traco/60 dark:border-traco-escuro/60"
              />
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 border-t border-traco dark:border-traco-escuro"
              />
              <div className="absolute inset-0 flex items-end gap-1.5">
                {dias.map((d, i) => {
                  // O PISO DE 8% É PARA A BARRA DE 1 EXISTIR. Num dia de pico
                  // alto, 1/max some abaixo de um pixel — e "nenhuma" e "uma"
                  // passariam a parecer a mesma coisa. O dia zerado fica com
                  // 3%, que é o fio do chão e não uma barra.
                  const altura = d.n > 0 ? Math.max((d.n / max) * 100, 8) : 3;
                  return (
                    <div
                      key={d.chave}
                      title={`${d.n} ${d.n === 1 ? "mensagem" : "mensagens"} em ${d.chave.slice(8)}/${d.chave.slice(5, 7)}`}
                      className={`group relative flex-1 rounded-t-lg transition-colors ${
                        d.n > 0
                          ? "bg-tinta hover:bg-acao dark:bg-tinta-escuro dark:hover:bg-acao-escuro"
                          : "bg-traco dark:bg-traco-escuro"
                      }`}
                      style={{ height: `${altura}%` }}
                    >
                      {/* O VALOR SÓ NO PICO, e não em todas as barras: catorze
                          números de 11px sobre catorze barras estreitas viram
                          uma faixa de ruído. O pico ancora a leitura, e o eixo
                          à esquerda dá o resto.
                          
                          E ELE VAI DENTRO DA BARRA, não acima. Acima ele batia
                          na linha do topo do eixo e saía cortado pela borda do
                          cartão — a barra do pico tem 100% de altura por
                          definição, então não há espaço em cima dela. Dentro
                          sempre cabe, pelo mesmo motivo.
                          
                          A COR INVERTE COM O TEMA, como a do botão: a barra é
                          escura sobre página clara e clara sobre página escura,
                          então o número que fica em cima dela é o `papel` de um
                          tema e o do outro. */}
                      {i === pico && (
                        <span
                          className={`absolute inset-x-0 top-1 text-center text-[11px] font-semibold text-papel dark:text-papel-escuro ${numero}`}
                        >
                          {d.n}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 flex gap-1.5">
              {dias.map((d, i) => (
                <span
                  key={d.chave}
                  className={`flex-1 text-center text-[11px] ${numero} ${muted}`}
                >
                  {i % 2 === 0 ? d.rotulo : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
