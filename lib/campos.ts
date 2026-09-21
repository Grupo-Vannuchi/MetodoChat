// O CATÁLOGO DE CAMPOS QUE A AUTOMAÇÃO SABE PEDIR — e por que existe um único
// arquivo para isto.
//
// MÓDULO PURO, e sem `server-only` de propósito: a suíte padrão
// (vitest.config.ts) não tem banco nem DOM, e é ali que este arquivo precisa
// rodar — é a mesma disciplina de `lib/conexao.ts` e de `lib/imagem-quebrada.ts`.
// Antes desta peça, a automação só sabia pedir e-mail, com a regra espalhada
// pelo motor. Generalizar para telefone, nome e data de nascimento sem um dono
// único da regra "o que é um campo e como ele se extrai" teria criado uma
// cópia divergente por campo — o mesmo defeito que `KINDS_MANUAIS`
// (lib/envio-filters.ts) e `EVENT_TYPES` (lib/event-filters.ts) existem para
// evitar.
//
// O E-MAIL NÃO GANHA EXTRATOR NOVO: `extractEmail` (lib/match.ts) já é o que
// o motor usa hoje em produção para reconhecer e-mail dentro de uma frase.
// Reescrever a regex aqui criaria uma segunda verdade sobre o que é um e-mail
// válido — o par validaria diferente do que grava, e o defeito só apareceria
// na borda que um dos dois esquecesse.

import { extractEmail } from "./match";

// Quantas vezes a automação repergunta antes de desistir do campo. É
// constante do catálogo, e não campo do editor, porque a regra é do produto
// — não é ajuste que cada automação deva poder tornar diferente.
export const TETO_DE_TENTATIVAS = 3;

export type Campo = {
  chave: string;
  rotulo: string;
  perguntaPadrao: string;
  reperguntar: string;
  extrair(texto: string): string | null;
  variavel: string;
  exemplo: string;
};

// Acha um telefone dentro da frase e devolve só os dígitos, sem DDI — é o
// formato que dá para exportar e discar; a máscara que a pessoa digitou
// ("(11) 99999-9999") é enfeite, não dado.
//
// A REGRA É POR QUANTIDADE DE DÍGITOS, e não por lista de exceções: "1990" não
// é telefone porque tem 4 dígitos, não porque "parece ano". Uma lista de
// exceções (anos, CPF, CEP...) sempre esquece um caso; contar dígitos não.
// Exportada, junto com as duas seguintes, porque a Tarefa 1 pede os
// extratores testáveis por fora do catálogo — o teste de hoje chama por
// `campoPorChave(...).extrair`, mas tarefas futuras (o editor, a normalização
// de chave livre) podem precisar do extrator isolado sem montar um `Campo`.
//
// POR QUE OS DÍGITOS SÃO CONTADOS POR BLOCO, E NÃO NO TEXTO INTEIRO: contar
// todo dígito da frase de uma vez faz "111.222.333-44" (CPF) somar 11 dígitos
// e passar pela mesma contagem de um celular — a suíte desta tarefa provou
// isso na prática (`tests/campos.test.ts`, caso "recusa... CPF"): o corte só
// por `digitos.length` do texto inteiro FICA VERDE mesmo com CPF na entrada,
// porque 11 dígitos é 11 dígitos, não importa de onde vieram. A correção não é
// reconhecer CPF por forma (isso seria a mesma lista de exceções que o
// parágrafo acima recusa) — é não juntar dígitos que a pessoa nunca escreveu
// juntos: telefone de verdade usa espaço, parênteses, `+` e hífen como
// separador; ponto não aparece em nenhum dos casos de telefone desta suíte, e
// é exatamente o que separa os três grupos do CPF. Cortando o texto em blocos
// de "cara de telefone" (dígito e essa pontuação) e testando o tamanho de CADA
// bloco, os três pedaços do CPF (3, 3 e 5 dígitos) nunca chegam a 10.
const BLOCO_DE_TELEFONE = /[\d\s()+-]+/g;

export function extrairTelefone(texto: string): string | null {
  for (const bloco of texto.match(BLOCO_DE_TELEFONE) ?? []) {
    const digitos = (bloco.match(/\d/g) ?? []).join("");
    // O DDI 55 só é removido quando sobra dígito demais para ser DDD+número —
    // do contrário um fixo de 10 dígitos que por acaso começa com "55"
    // perderia os dois primeiros à toa.
    const semDdi = digitos.startsWith("55") && digitos.length > 11
      ? digitos.slice(2)
      : digitos;
    if (semDdi.length === 10 || semDdi.length === 11) return semDdi;
  }
  return null;
}

const PREFIXO_DE_NOME = /^\s*(?:meu\s+nome\s+(?:é|eh|e)\s+|me\s+chamo\s+|sou\s+o\s+|sou\s+a\s+)/i;
const TEM_LETRA_OU_DIGITO = /[\p{L}\p{N}]/u;

// Tira o prefixo de apresentação ("sou a ", "meu nome é ", ...) e devolve o
// que sobrou como nome.
//
// O PREFIXO É REMOVIDO SEMPRE, inclusive em "sou a ana" → "ana": quem responde
// assim está dizendo que o nome é Ana, e guardar a frase inteira faria
// `{{nome_informado}}` mandar "Oi sou a ana" de volta pra pessoa.
//
// A RECUSA É FRACA DE PROPÓSITO, e é sobre o que se ACEITA (emoji junto, sem
// maiúscula) — não sobre deixar o prefixo. Uma lista de palavras proibidas
// sempre erra alguém; o custo de aceitar "ana 😊" é menor que o de recusar um
// nome de verdade porque veio com emoji junto.
export function extrairNome(texto: string): string | null {
  const limpo = texto.replace(PREFIXO_DE_NOME, "").trim();
  if (!limpo) return null;
  if (!TEM_LETRA_OU_DIGITO.test(limpo)) return null; // só emoji/pontuação
  if (limpo.length > 60) return null; // isto é frase, não nome
  return limpo;
}

// Lê data em BR (dd/mm/aaaa) ou ISO (aaaa-mm-dd) e devolve sempre em ISO.
//
// A CONFERÊNCIA DE VOLTA EXISTE PORQUE `new Date(...)` NÃO RECUSA DATA
// IMPOSSÍVEL — ele rola: `Date.UTC(1990, 1, 30)` (30 de fevereiro) vira 2 de
// março, calado. Sem comparar os componentes de volta com o que a `Date`
// devolveu, "30/02/1990" seria aceito como uma data real e errada.
export function extrairNascimento(texto: string): string | null {
  const br = texto.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  const iso = texto.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  let a: number, m: number, d: number;
  if (iso) {
    [, a, m, d] = iso.map(Number) as [unknown, number, number, number];
  } else if (br) {
    [, d, m, a] = br.map(Number) as [unknown, number, number, number];
  } else {
    return null;
  }

  const data = new Date(Date.UTC(a, m - 1, d));
  if (
    data.getUTCFullYear() !== a ||
    data.getUTCMonth() !== m - 1 ||
    data.getUTCDate() !== d
  ) {
    return null;
  }
  if (data.getTime() > Date.now()) return null; // nascer no futuro, não
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export const CAMPOS: Campo[] = [
  {
    chave: "email",
    rotulo: "E-mail",
    perguntaPadrao: "Me manda seu melhor e-mail que eu te envio o link 👇",
    reperguntar: "Acho que esse e-mail saiu errado 🤔 Me manda de novo, só o e-mail.",
    extrair: extractEmail,
    variavel: "email",
    exemplo: "ana@email.com",
  },
  {
    chave: "telefone",
    rotulo: "Telefone / WhatsApp",
    perguntaPadrao: "Me manda seu WhatsApp com DDD 👇",
    reperguntar: "Não consegui ler esse número 🤔 Me manda com DDD, só os números.",
    extrair: extrairTelefone,
    variavel: "telefone",
    exemplo: "(11) 99999-9999",
  },
  {
    chave: "nome_informado",
    rotulo: "Nome informado",
    perguntaPadrao: "Como você prefere que eu te chame?",
    reperguntar: "Não entendi 🤔 Me manda só o nome.",
    extrair: extrairNome,
    variavel: "nome_informado",
    exemplo: "Ana",
  },
  {
    chave: "nascimento",
    rotulo: "Data de nascimento",
    perguntaPadrao: "Qual sua data de nascimento? (dia/mês/ano)",
    reperguntar: "Essa data não deu certo 🤔 Me manda como 01/02/1990.",
    extrair: extrairNascimento,
    variavel: "nascimento",
    exemplo: "01/02/1990",
  },
];

const POR_CHAVE = new Map(CAMPOS.map((c) => [c.chave, c]));

export function campoPorChave(chave: string): Campo | undefined {
  return POR_CHAVE.get(chave);
}
