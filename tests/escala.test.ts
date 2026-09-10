import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { TAMANHOS_PX, CLASSE_POR_TAMANHO, desviosDeEscala } from "../app/escala";
import * as ui from "../app/ui";

// O QUE ESTE ARQUIVO FIXA (achado M1): a escala tipográfica não volta a se
// fragmentar.
//
// O DEFEITO, medido na tela com o auditor, nas nove rotas e nos dois temas:
// **26 combinações de tamanho e peso, em 13 tamanhos** — 9, 10, 11, 12, 13, 14,
// 15, 16, 17, 18, 20, 24, 30. Três pares que ninguém distingue (12/13, 14/15,
// 16/17) e um piso abaixo do que se lê: `10px` em 276 ocorrências e `9px` em 7.
//
// A DIFERENÇA ENTRE ESTE PORTÃO E UM COMENTÁRIO: a fragmentação não entrou por
// uma decisão errada, entrou por 26 decisões pequenas em meses diferentes. O
// que a impede de voltar não é saber a regra — é uma varredura que reprova.
//
// ELE VARRE ARQUIVO, e não DOM. É a única forma de medir "depois" nesta
// rodada: a Onda 3 não pôde rodar `next build` nem `npm run dev`, então o
// número renderizado ficou sem prova. O que este arquivo prova é o que está
// escrito na árvore — que é de onde o renderizado sai.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

// O EDITOR FICA DE FORA, e a exceção é declarada porque exceção não declarada
// é amostra que se chama de varredura. Dois motivos, e são diferentes:
//
//   `editor/previa.tsx` desenha o Instagram dentro de um telefone de 300px de
//   largura. Os 9px e 10px dele não são a tipografia DESTE produto: são a
//   maquete de outro, em escala reduzida. Igualá-los à nossa escala quebraria
//   a semelhança, que é a função inteira daquela tela.
//
//   O resto de `editor/` desenha dentro de um quadro com zoom (`@xyflow`), em
//   nós de largura fixa. Um px de texto a mais move um layout que esta rodada
//   não tem como conferir sem renderizar — e o editor não está entre as nove
//   rotas que a auditoria mediu, então nenhum dos 276 `10px` medidos vem dele.
//
// É DÍVIDA DECLARADA, e não isenção: quando houver como ver a tela, o editor
// entra.
const FORA_DA_VARREDURA = ["app/automacoes/editor"];

function arquivosDeTela(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    const rel = relative(RAIZ, caminho).replace(/\\/g, "/");
    if (FORA_DA_VARREDURA.some((f) => rel === f || rel.startsWith(`${f}/`))) continue;
    if (statSync(caminho).isDirectory()) {
      arquivosDeTela(caminho, achados);
    } else if (/\.tsx?$/.test(nome)) {
      achados.push(caminho);
    }
  }
  return achados;
}

const ARQUIVOS = arquivosDeTela(join(RAIZ, "app"));

// COMENTÁRIO NÃO É CLASSE, e este é o primeiro defeito que a varredura teve:
// ela acusava `app/ui.ts` e `app/escala.ts` porque os dois EXPLICAM, em
// comentário, os tamanhos que morreram. Um portão que reprova a documentação
// do próprio conserto não sobrevive a uma semana — alguém apaga a explicação
// para o teste passar, e o motivo da decisão vai junto.
//
// O `//` só cai quando NÃO vem depois de `:`, para `https://` continuar
// inteiro. Não é um analisador de TypeScript, e não precisa ser: o que ele tem
// de fazer é não confundir prosa com className.
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("a varredura", () => {
  it("enxerga a árvore que diz enxergar", () => {
    // Uma varredura vazia passa por vacuidade. Este caso é o que impede isso.
    expect(ARQUIVOS.length).toBeGreaterThan(30);
    const rel = ARQUIVOS.map((a) => relative(RAIZ, a).replace(/\\/g, "/"));
    expect(rel).toContain("app/ui.ts");
    expect(rel).toContain("app/app-shell.tsx");
    expect(rel.some((r) => r.startsWith("app/automacoes/editor/"))).toBe(false);
  });

  it("acusa quando há o que acusar — se não acusa nada, não mede nada", () => {
    // A contraprova do verificador: os cinco tamanhos que morreram nesta onda,
    // e um que nunca existiu.
    expect(desviosDeEscala("text-[9px] font-medium")).toHaveLength(1);
    expect(desviosDeEscala("mt-1 text-[10px] uppercase")).toHaveLength(1);
    expect(desviosDeEscala("text-[13px] sm:text-[22px]")).toHaveLength(2);
    expect(desviosDeEscala("text-[15px] text-[17px]")).toHaveLength(2);
    expect(desviosDeEscala("text-[7px]")).toHaveLength(1);
  });

  it("não acusa o que é a escala", () => {
    expect(desviosDeEscala("text-[11px] text-xs text-sm text-base")).toEqual([]);
    expect(desviosDeEscala("text-lg text-xl text-2xl text-3xl")).toEqual([]);
    expect(desviosDeEscala("sm:text-[11px] lg:text-2xl")).toEqual([]);
    // `text-zinc-500` tem "text-" e não é tamanho; `max-w-[22rem]` tem `[22`.
    expect(desviosDeEscala("text-zinc-600 max-w-[22rem] gap-[10px]")).toEqual([]);
  });
});

describe("a escala tipográfica", () => {
  it("tem oito degraus, e eram treze", () => {
    expect(TAMANHOS_PX.length).toBe(8);
    expect([...TAMANHOS_PX]).toEqual([11, 12, 14, 16, 18, 20, 24, 30]);
    // os cinco que saíram, para o número do defeito não se perder
    for (const morto of [9, 10, 13, 15, 17, 22]) {
      expect(TAMANHOS_PX as readonly number[]).not.toContain(morto);
    }
  });

  it("o piso é 11px: nada abaixo dele, e 9 e 10 eram 283 ocorrências na tela", () => {
    expect(Math.min(...TAMANHOS_PX)).toBe(11);
  });

  it("cada degrau tem uma classe, e nenhuma se repete", () => {
    const classes = TAMANHOS_PX.map((px) => CLASSE_POR_TAMANHO[px]);
    expect(classes.every(Boolean)).toBe(true);
    expect(new Set(classes).size).toBe(classes.length);
  });

  it("os pares que o olho não distingue foram fechados", () => {
    const tem = (px: number) => (TAMANHOS_PX as readonly number[]).includes(px);
    // 12/13, 14/15, 16/17 — em cada par sobra um só
    expect(tem(12) && tem(13)).toBe(false);
    expect(tem(14) && tem(15)).toBe(false);
    expect(tem(16) && tem(17)).toBe(false);
  });
});

describe("nenhum arquivo de tela fura a escala", () => {
  it("fora do editor, não sobrou um tamanho arbitrário fora da lista", () => {
    const furos: string[] = [];
    for (const caminho of ARQUIVOS) {
      const conteudo = semComentarios(readFileSync(caminho, "utf8"));
      for (const d of desviosDeEscala(conteudo)) {
        furos.push(`${relative(RAIZ, caminho).replace(/\\/g, "/")}: ${d.classe}`);
      }
    }
    expect(furos).toEqual([]);
  });

  it("os tokens de `app/ui.ts` também obedecem", () => {
    // Eles são a origem da maioria das ocorrências na tela: um furo aqui vale
    // por centenas lá.
    for (const [nome, valor] of Object.entries(ui)) {
      if (typeof valor !== "string") continue;
      expect(desviosDeEscala(valor), `${nome}: ${valor}`).toEqual([]);
    }
  });
});
