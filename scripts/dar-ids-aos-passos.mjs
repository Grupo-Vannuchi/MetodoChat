// Dá id a todo bloco de toda automação que ainda não tem, e reescreve as chaves
// de deduplicação DE HOJE para a identidade nova.
//
// REGRA DE OPERAÇÃO, em uma frase: ele reescreve as chaves do balde de hoje
// porque a identidade do bloco mudou de índice para id, e é justamente por
// fazer essa reescrita que ele pode ser rodado a QUALQUER HORA — sem ela, ele
// só seria seguro na virada do dia.
//
// O que a reescrita conserta: até a migração, a identidade de um bloco na
// `dedupe_key` era o ÍNDICE (`passo:<automação>:<pessoa>:0:<dia>`). Depois dela
// é o id (`…:b_f3br5j3n:<dia>`). A linha `sent` que já está na fila com a forma
// antiga deixa de casar com a chave que o código produz agora, e o
// `on conflict do nothing` para de segurar: quem reacionar a automação ainda
// hoje recebe de novo o que já recebeu. Reacionar é corriqueiro — basta a
// pessoa repetir a palavra-chave, que é o que ela acabou de ler na boas-vindas.
//
// Preserva a ordem e todo o resto do objeto: só acrescenta o campo `id` onde
// falta. Idempotente — rodar duas vezes não muda nada na segunda, nem nos
// passos nem nas chaves.
//
// "A QUALQUER HORA" vale para a janela que a MIGRAÇÃO abre, e só para ela. Há
// uma outra janela da mesma classe que este script NÃO alcança, por construção:
// `montarPassos` (app/automacoes/actions.ts) chama `novoIdDeBloco()` em todos os
// sete `passos.push`, tanto ao criar quanto ao editar pelo formulário — nada ali
// lê os `steps` já gravados. Ou seja, salvar uma automação pelo formulário
// antigo sorteia ids NOVOS para todos os blocos dela, e as chaves
// `passo:…:<id antigo>:<hoje>` já enviadas naquele dia deixam de casar — o
// mesmo sintoma que a migração produziu, com a mesma reação em cadeia. Este
// script não conserta esse estado porque ele só reconhece identidade NUMÉRICA
// (índice) como origem da reescrita; `b_antigo → b_novo` está fora do alcance
// dele. Este script fecha a janela da migração; a janela do formulário só
// fecha quando o formulário sair (Tarefa 8 do plano) — até lá, salvar uma
// automação no mesmo dia em que ela entregou mensagens pode reentregá-las.
import postgres from "postgres";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { prepare: false, ssl: "require", onnotice: () => {} });

// A TERCEIRA CÓPIA de `novoIdDeBloco`, e ela continua sendo uma cópia pelo mesmo
// motivo do regex logo abaixo: este script é JavaScript solto, roda por `node`
// direto e NÃO importa de `lib/steps.ts`, que é TypeScript. As outras duas
// cópias (actions.ts e editor/modelos.ts) viraram uma só lá; esta não tem como.
//
// Ela tinha o mesmo defeito que as outras duas: `Math.random().toString(36)
// .slice(2, 10)` pode devolver menos de 6 caracteres, e aí o id gravado não casa
// com `temId` — o bloco receberia um id que o resto do sistema recusa, cairia na
// identidade por índice, e a reescrita de chave que este script existe para
// fazer pularia justamente ele. Comprimento FIXO em 8 resolve por construção.
const ALFABETO_DO_ID = "0123456789abcdefghijklmnopqrstuvwxyz";
const novoId = () => {
  let id = "b_";
  for (let i = 0; i < 8; i++) {
    id += ALFABETO_DO_ID[Math.floor(Math.random() * ALFABETO_DO_ID.length)];
  }
  return id;
};
// Este regex TEM QUE CONCORDAR com `FORMA_DO_ID` (lib/steps.ts) — mesmo motivo
// do balde do dia logo abaixo: são a MESMA regra escrita duas vezes porque este
// script não pode importar de `lib/steps.ts`, que é TypeScript. Divergindo, um
// id que `identidadeDoPasso` aceitaria como bloco passaria batido aqui como
// "sem id" (ou vice-versa), e a reescrita de chave e o resto do sistema
// deixariam de concordar sobre o que é um id válido.
const temId = (p) => p && typeof p === "object" && /^b_[0-9a-z]{6,}$/.test(p.id ?? "");

// O balde do dia, em BRASÍLIA — e ele TEM QUE CONCORDAR BYTE A BYTE com
// `diaDaChave` (lib/dedupe.ts): mesmo `Intl.DateTimeFormat`, mesmo locale
// `en-CA` (o que formata `YYYY-MM-DD`) e mesmo `timeZone: "America/Sao_Paulo"`.
// Se os dois divergirem, este script faz o oposto do que promete — mexe num
// balde que já não segura nada e deixa intacta a chave que ainda segura,
// mantendo a janela de reentrega aberta. Em UTC a divergência aparece todo dia
// entre 21h e meia-noite de Brasília, que é o horário de pico.
const hoje = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const linhas = await sql`select id, name, steps from automations`;
let mexidas = 0;
let reescritas = 0;
let colisoes = 0;

console.log(`balde de hoje (Brasília): ${hoje}\n`);

for (const a of linhas) {
  const passos = Array.isArray(a.steps) ? a.steps : [];
  const faltando = passos.filter((p) => !temId(p)).length;
  const novos = passos.map((p) => (temId(p) ? p : { ...p, id: novoId() }));

  // A gravação dos ids e a reescrita das chaves vão na MESMA transação. Separadas,
  // uma falha no meio deixaria ids novos com chaves velhas — que é exatamente o
  // estado que este script existe para consertar.
  const conta = await sql.begin(async (tx) => {
    if (faltando) {
      await tx`update automations set steps = ${sql.json(novos)} where id = ${a.id}`;
    }

    // A reescrita percorre TODO bloco com id, e não só os que acabaram de
    // ganhar um. É deliberado: a migração pode já ter rodado (foi o que
    // aconteceu em produção), e nesse caso não há bloco novo nenhum — mas as
    // chaves antigas continuam na fila, com o índice, e são elas o problema.
    // Amarrar a reescrita ao "ganhou id agora" faria o script não consertar
    // justamente o banco que precisa de conserto.
    const daAutomacao = await tx`
      select id, dedupe_key from queue
      where dedupe_key like ${"passo:" + a.id + ":%"}`;

    // Todas as chaves que podem colidir com um destino têm este mesmo prefixo,
    // então este conjunto é completo — dá para decidir sem ir ao banco de novo.
    const existentes = new Set(daAutomacao.map((r) => r.dedupe_key));
    let feitas = 0;
    let batidas = 0;

    for (const r of daAutomacao) {
      // passo:<automação>:<pessoa>:<identidade>:<dia>
      const partes = r.dedupe_key.split(":");
      if (partes.length !== 5) continue;
      const [, automacao, pessoa, identidade, dia] = partes;

      // SÓ O BALDE DE HOJE. Chave de dia anterior já não segura nada — o balde
      // do dia é o que a expira —, então reescrevê-la é trabalho sem efeito e
      // risco à toa.
      if (automacao !== a.id || dia !== hoje) continue;

      // Só interessa chave gravada com ÍNDICE. A que já traz um id (`b_…`) não
      // é número e cai fora aqui, o que é o que torna o script idempotente.
      const i = Number(identidade);
      if (!Number.isInteger(i) || String(i) !== identidade) continue;

      const bloco = novos[i];
      if (!temId(bloco)) continue;

      const destino = `passo:${automacao}:${pessoa}:${bloco.id}:${dia}`;

      // `dedupe_key` é UNIQUE. Se o destino já existe, as duas formas da mesma
      // mensagem já estão na fila e a reescrita não tem o que consertar — o que
      // importa é não estourar (o UNIQUE abortaria a transação inteira) e o
      // operador saber que aconteceu.
      if (existentes.has(destino)) {
        batidas++;
        console.log(`colide ${r.dedupe_key}\n    →  ${destino}`);
        continue;
      }

      await tx`update queue set dedupe_key = ${destino} where id = ${r.id}`;
      existentes.delete(r.dedupe_key);
      existentes.add(destino);
      feitas++;
      console.log(`       ${r.dedupe_key}\n    →  ${destino}`);
    }

    return { feitas, batidas };
  });

  reescritas += conta.feitas;
  colisoes += conta.batidas;

  if (faltando) {
    mexidas++;
    console.log(`  ►    ${a.name} — ${faltando} de ${passos.length} blocos ganharam id`);
  } else {
    console.log(`  ok   ${a.name} — ${passos.length} blocos, todos com id`);
  }
}

console.log(`\n${mexidas} automação(ões) alterada(s) de ${linhas.length}.`);
console.log(`${reescritas} chave(s) de hoje reescrita(s) do índice para o id.`);
console.log(`${colisoes} colisão(ões): a chave de destino já existia, e a linha ficou como estava.`);
await sql.end();
