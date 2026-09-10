import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { btnPrimary, link } from "../app/ui";
import {
  tom,
  luminancia,
  contraste,
  piorCaso,
  MINIMO,
  CORES_NOMEADAS,
  FUNDOS_CLAROS,
  FUNDOS_ESCUROS,
  FUNDOS,
} from "./medidor";

// O QUE ESTE ARQUIVO FIXA (Parte 1 da linguagem visual): a paleta nomeada é
// MEDIDA, e o número que cada cor declara em `app/globals.css` não vira mentira.
//
// POR QUE ELE EXISTE, e não bastava o comentário: `zinc-500` esteve nove dos
// quinze fundos do produto abaixo de 4,5:1 por meses, e ninguém viu — porque
// `zinc-500` não diz nada sobre contraste. O nome novo (`text-quieto`) diz o
// PAPEL; quem tem de dizer o NÚMERO é uma varredura que reprova.
//
// A SUÍTE NÃO TESTA COMPONENTE, então o portão aqui é o mesmo das Ondas 2 e 3:
// a aritmética da cor contra os fundos REAIS do produto (`tests/medidor.ts`).
//
// O QUE ESTE ARQUIVO NÃO PROVA: que a tela renderizada mudou. Esta entrega não
// pôde rodar `next build` nem `npm run dev`, então o número DEPOIS é calculado,
// e não medido no navegador.

const luminanciaDe = (nome: string) => luminancia(tom(nome));

/** A distância de matiz entre duas cores, em graus, pelo caminho mais curto. */
function distanciaDeMatiz(a: string, b: string): number {
  const matiz = ([r, g, b2]: readonly [number, number, number]) => {
    const alto = Math.max(r, g, b2);
    const baixo = Math.min(r, g, b2);
    const d = alto - baixo;
    if (d === 0) return 0;
    const h =
      alto === r ? ((g - b2) / d) % 6 : alto === g ? (b2 - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const bruta = Math.abs(matiz(tom(a)) - matiz(tom(b)));
  return bruta > 180 ? 360 - bruta : bruta;
}

const CSS = readFileSync(
  fileURLToPath(new URL("../app/globals.css", import.meta.url)),
  "utf8"
);

/* ---------- os sete papéis, e o par escuro de cada um ---------- */

const PAPEIS = [
  "papel",
  "tinta",
  "acao",
  "traco",
  "quieto",
  "aberto",
  "fecha",
  "parou",
] as const;

// As duas que pintam SUPERFÍCIE e FIO, e por isso não respondem ao mínimo de
// texto: o 4,5:1 da WCAG é para texto. O que se cobra delas é serem declaradas
// como tais — ver o caso "declara o que cada cor é".
const NAO_SAO_TEXTO = new Set(["papel", "traco"]);

describe("a paleta nomeada", () => {
  it("tem os sete papéis, e cada um com o seu par do tema escuro", () => {
    for (const nome of PAPEIS) {
      expect(CORES_NOMEADAS, nome).toContain(nome);
      expect(CORES_NOMEADAS, `${nome}-escuro`).toContain(`${nome}-escuro`);
    }
    // dezesseis e nada mais: cor sem papel declarado é a porta por onde a
    // paleta volta a se acumular, que foi o diagnóstico da auditoria ("a
    // identidade não foi decidida, foi acumulada"). `acao` entrou por este
    // caminho — nomeada, medida e com o motivo escrito ao lado.
    expect(CORES_NOMEADAS.length).toBe(PAPEIS.length * 2);
  });

  it("NENHUM par usa o mesmo valor nos dois temas — é a regra da Onda 3", () => {
    // Texto que não troca de tema erra num dos dois SEMPRE: o fundo mudou e ele
    // não. A regra nasceu no `tomQuieto` e agora vale para a paleta inteira.
    for (const nome of PAPEIS) {
      expect(tom(nome), nome).not.toEqual(tom(`${nome}-escuro`));
    }
  });

  it("o índigo não está entre elas, em nenhuma forma", () => {
    // A cor de marca e de ação saiu; o que sobrou de cor tem significado de
    // estado. Se alguém a trouxer de volta pela porta do `@theme`, é aqui.
    expect(CSS).not.toMatch(/indigo|violet|purple|#(4f46e5|6366f1|818cf8)/i);
  });
});

/* ---------- o número que cada cor declara ao lado de si ---------- */

// `--color-quieto: #6b6862; /* pior 5,05 *␑/` -> ["quieto", 5.05]
// `--color-papel: #fbfaf8;  /* fundo *␑/`     -> ["papel", null]
function declaracoes(): [string, number | null][] {
  const achados: [string, number | null][] = [];
  const padrao = /--color-([a-z][a-z-]*):\s*#[0-9a-f]{6};\s*\/\*\s*(?:pior\s+([\d,]+)|fundo|fio)\s*\*\//gi;
  for (const m of CSS.matchAll(padrao)) {
    achados.push([m[1], m[2] ? Number(m[2].replace(",", ".")) : null]);
  }
  return achados;
}

describe("cada cor declara, ao lado de si, o número que tem de manter", () => {
  it("as catorze estão declaradas — nenhuma entra sem dizer o que é", () => {
    const nomes = declaracoes().map(([n]) => n);
    expect(nomes.sort()).toEqual([...CORES_NOMEADAS].sort());
  });

  it("declara o que cada cor é: superfície e fio não fingem ser texto", () => {
    for (const [nome, pior] of declaracoes()) {
      const raiz = nome.replace(/-escuro$/, "");
      if (NAO_SAO_TEXTO.has(raiz)) {
        expect(pior, `${nome} não é texto e não deve declarar pior caso`).toBeNull();
      } else {
        expect(pior, `${nome} é texto e tem de declarar o pior caso`).not.toBeNull();
      }
    }
  });

  it("o número declarado é o número MEDIDO, e não um número lembrado", () => {
    // É este caso que impede o comentário de virar mentira: trocar o hex sem
    // trocar o número reprova aqui.
    for (const [nome, declarado] of declaracoes()) {
      if (declarado === null) continue;
      const fundos = nome.endsWith("-escuro") ? FUNDOS_ESCUROS : FUNDOS_CLAROS;
      expect(piorCaso(nome, fundos), nome).toBeCloseTo(declarado, 1);
    }
  });
});

/* ---------- a medição que autoriza cada cor a entrar ---------- */

describe("toda cor de texto passa o mínimo sobre TODOS os fundos reais", () => {
  it("no tema claro", () => {
    for (const nome of PAPEIS) {
      if (NAO_SAO_TEXTO.has(nome)) continue;
      for (const [fundo, rgb] of FUNDOS_CLAROS) {
        expect(contraste(tom(nome), rgb), `${nome} sobre ${fundo}`).toBeGreaterThanOrEqual(
          MINIMO
        );
      }
    }
  });

  it("no tema escuro", () => {
    for (const nome of PAPEIS) {
      if (NAO_SAO_TEXTO.has(nome)) continue;
      for (const [fundo, rgb] of FUNDOS_ESCUROS) {
        expect(
          contraste(tom(`${nome}-escuro`), rgb),
          `${nome}-escuro sobre ${fundo}`
        ).toBeGreaterThanOrEqual(MINIMO);
      }
    }
  });

  it("os dois piores casos do produto são os balões da conversa", () => {
    // O fundo claro mais ESCURO e o fundo escuro mais CLARO são a mesma tela
    // (`app/conversas/[id]`, o balão recebido), e são eles que mandam nas duas
    // escolhas. Quem for propor uma cor nova mede contra estes dois primeiro.
    for (const nome of ["tinta", "acao", "quieto", "aberto", "fecha", "parou"]) {
      expect(
        contraste(tom(nome), FUNDOS["claro: balao recebido (bg-zinc-100)"]),
        nome
      ).toBeCloseTo(piorCaso(nome, FUNDOS_CLAROS), 2);
      expect(
        contraste(tom(`${nome}-escuro`), FUNDOS["escuro: balao recebido (bg-zinc-800)"]),
        `${nome}-escuro`
      ).toBeCloseTo(piorCaso(`${nome}-escuro`, FUNDOS_ESCUROS), 2);
    }
  });
});

/* ---------- a ação é a única cor que preenche, e por isso mede duas ---------- */

describe("o rótulo sobre o preenchimento da ação", () => {
  // AS SETE OUTRAS CORES SÃO MEDIDAS CONTRA OS FUNDOS DO PRODUTO. `acao` tem um
  // segundo número que nenhuma delas tem: ela É um fundo, e o que se lê em cima
  // dela é o rótulo do botão. Sem este caso, alguém pode escurecer o petróleo
  // do tema escuro achando que ganha "presença" e apagar o texto do botão — e
  // o portão de cima passaria, porque lá `acao` só é medida como tinta.
  it("no tema claro o rótulo é `papel`, e ele se lê", () => {
    expect(contraste(tom("papel"), tom("acao"))).toBeGreaterThanOrEqual(MINIMO);
  });

  it("no tema escuro o rótulo é `papel-escuro`, e ele se lê", () => {
    expect(contraste(tom("papel-escuro"), tom("acao-escuro"))).toBeGreaterThanOrEqual(
      MINIMO
    );
  });

  it("a inversão entre os temas existe: o preenchimento troca de lado", () => {
    // No claro o botão é ESCURO sobre página clara; no escuro é CLARO sobre
    // página escura. É isso que mantém a ação sendo o maior contraste da tela
    // nos dois temas, que era a única coisa que a pastilha branca acertava.
    expect(luminanciaDe("acao")).toBeLessThan(luminanciaDe("papel"));
    expect(luminanciaDe("acao-escuro")).toBeGreaterThan(luminanciaDe("papel-escuro"));
  });

  it("não é o verde de `aberto` com outro nome", () => {
    // O risco real desta cor: petróleo e "janela aberta" são os dois frios da
    // paleta. O que os separa é matiz, e o número é medido — não lembrado.
    expect(distanciaDeMatiz("acao", "aberto")).toBeGreaterThan(30);
    expect(distanciaDeMatiz("acao-escuro", "aberto-escuro")).toBeGreaterThan(30);
  });
});

/* ---------- o que a paleta NÃO pode fazer ---------- */

describe("a hierarquia entre normal e quieto", () => {
  it("o quieto não vira o contraste do texto NORMAL, nos dois temas", () => {
    // O limite de CIMA também é medido, e a razão é a mesma da Onda 3: texto
    // quieto que grita deixa de ser quieto, e o achado pedia legibilidade e não
    // hierarquia invertida.
    const cartaoClaro = FUNDOS["claro: cartao (bg-white)"];
    const cartaoEscuro = FUNDOS["escuro: cartao (bg-zinc-900/70)"];
    expect(contraste(tom("quieto"), cartaoClaro)).toBeLessThan(
      contraste(tom("tinta"), cartaoClaro) - 3
    );
    expect(contraste(tom("quieto-escuro"), cartaoEscuro)).toBeLessThan(
      contraste(tom("tinta-escuro"), cartaoEscuro) - 3
    );
  });

  it("o par escuro do quieto não regride o que a Onda 3 tinha conquistado", () => {
    // `zinc-400` dava 5,68:1 no pior fundo escuro. O tom novo é morno, e a
    // troca de temperatura não pode custar legibilidade.
    expect(piorCaso("quieto-escuro", FUNDOS_ESCUROS)).toBeGreaterThanOrEqual(
      contraste(tom("zinc-400"), FUNDOS["escuro: balao recebido (bg-zinc-800)"])
    );
  });
});

/* ---------- o índigo saiu, e a varredura é o que o mantém fora ---------- */

// ERAM 147 OCORRÊNCIAS DE `indigo`/`violet`/`purple` EM MAIS DE 20 ARQUIVOS —
// cor de marca e cor de ação ao mesmo tempo, e o que mais fazia o painel parecer
// modelo. Comentário não impede a 148ª; uma varredura que reprova impede.
//
// ELA VARRE ARQUIVO, e não DOM, pelo mesmo motivo de `tests/escala.test.ts`:
// esta entrega não pôde rodar `next build` nem `npm run dev`, então o que dá
// para provar é o que está escrito na árvore — que é de onde o renderizado sai.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

// A ÚNICA EXCEÇÃO, E ELA É DECLARADA — exceção não declarada é amostra que se
// chama de varredura.
//
// `app/automacoes/editor/previa.tsx` desenha o INSTAGRAM dentro de um telefone
// de 300px de largura: o anel do story e o avatar do perfil. Aqueles dois
// gradientes são a marca do Instagram, e não a deste produto; trocá-los pela
// paleta do painel faria a prévia deixar de parecer o lugar onde a mensagem vai
// chegar, que é a função inteira daquela tela. `tests/escala.test.ts` já declara
// uma exceção para o mesmo diretório e pelo mesmo motivo: ali a maquete é de
// outro produto.
//
// A EXCEÇÃO É PELA FORMA EXATA DO GRADIENTE, e não pelo arquivo: qualquer outro
// `indigo`/`violet`/`purple` dentro de `previa.tsx` continua reprovando — foi
// assim que o `bg-indigo-500/10` do destaque de bloco, que ficava no MESMO
// arquivo, foi pego e trocado pela tinta.
const GRADIENTES_DO_INSTAGRAM = [
  "bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600",
  "bg-gradient-to-br from-purple-600 to-orange-400",
];

const ARQUIVO_DA_MAQUETE = "app/automacoes/editor/previa.tsx";

function arquivosDeTela(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosDeTela(caminho, achados);
    else if (/\.tsx?$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

// COMENTÁRIO NÃO É CLASSE, e este é o mesmo cuidado de `tests/escala.test.ts`:
// vários arquivos EXPLICAM, em comentário, o índigo que saiu. Um portão que
// reprova a documentação do próprio conserto não sobrevive a uma semana — alguém
// apaga a explicação para o teste passar, e o motivo vai junto.
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("a varredura do índigo", () => {
  const arquivos = arquivosDeTela(join(RAIZ, "app"));

  it("enxerga a árvore que diz enxergar", () => {
    // Uma varredura vazia passa por vacuidade. Este caso é o que impede isso.
    expect(arquivos.length).toBeGreaterThan(30);
    const rel = arquivos.map((a) => relative(RAIZ, a).replace(/\\/g, "/"));
    expect(rel).toContain("app/ui.ts");
    expect(rel).toContain("app/layout.tsx");
    expect(rel).toContain(ARQUIVO_DA_MAQUETE);
  });

  it("não sobrou nenhum `indigo`, `violet` ou `purple` na árvore", () => {
    const sobras: string[] = [];
    for (const caminho of arquivos) {
      const rel = relative(RAIZ, caminho).replace(/\\/g, "/");
      let conteudo = semComentarios(readFileSync(caminho, "utf8"));
      if (rel === ARQUIVO_DA_MAQUETE) {
        for (const g of GRADIENTES_DO_INSTAGRAM) conteudo = conteudo.split(g).join(" ");
      }
      for (const m of conteudo.matchAll(/[\w/-]*(?:indigo|violet|purple)[\w/-]*/gi)) {
        sobras.push(`${rel}: ${m[0]}`);
      }
    }
    expect(sobras).toEqual([]);
  });

  it("a exceção da maquete existe DE VERDADE — senão ela não está isentando nada", () => {
    // Uma isenção que não corresponde a nenhuma linha do arquivo é uma isenção
    // esquecida, e ela iria isentar o próximo índigo que caísse ali.
    const fonte = readFileSync(join(RAIZ, ARQUIVO_DA_MAQUETE), "utf8");
    for (const g of GRADIENTES_DO_INSTAGRAM) expect(fonte, g).toContain(g);
  });

  it("a ação usa o petróleo, e o link continua sendo tinta sublinhada", () => {
    // `btnPrimary` e `link` eram os dois lugares em que o índigo mais se via, e
    // são os dois que separam SUPERFÍCIE de TEXTO: o botão é preenchido com
    // `acao`, e o link é tinta com sublinhado — nunca cor, porque um link
    // colorido no meio de um parágrafo volta a ser acento de marca.
    expect(btnPrimary).toContain("bg-acao");
    expect(btnPrimary).toContain("dark:bg-acao-escuro");
    expect(link).toContain("text-tinta");
    expect(link).toContain("underline");
    expect(link).not.toContain("acao");
  });
});
