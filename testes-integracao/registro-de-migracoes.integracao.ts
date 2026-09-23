// O APLICADOR DE VERDADE, RODADO DUAS VEZES.
//
// POR QUE ESTE ARQUIVO EXISTE, com a medição que o obrigou.
//
// Em 28/08/2026 dois builds de produção morreram aos 120 segundos, os dois no
// PRIMEIRO arquivo de migração, com `canceling statement due to statement
// timeout` (57014). Nenhuma das seis migrações tinha o que fazer.
//
// A causa: `alter table ... if not exists` pega a trava EXCLUSIVA da tabela
// ANTES de descobrir que não há nada a fazer. Um leitor parado numa transação
// aberta segura a tabela e derruba o deploy — inclusive o deploy que não muda
// uma vírgula do esquema. Foi um `npm run dev` apontando para o mesmo banco.
//
// O conserto é não executar o que já foi executado, e a decisão disso mora em
// `scripts/migracoes.mjs`, com 17 casos puros. MAS A DECISÃO PURA NÃO PROVA O
// QUE INTERESSA: o que interessa é o script, falando com um banco, decidindo
// pular. Essa é a fiação — e esta fase inteira mediu, oito vezes, que é na
// fiação entre camadas que o defeito sobrevive a tudo.
//
// Por isso aqui o script é EXECUTADO, como processo, do jeito que o build o
// executa. Duas vezes contra o mesmo schema. A segunda tem de não aplicar nada.
//
// ISOLAMENTO — por que isto não toca produção:
//   1. a `DATABASE_URL` entregue ao processo leva `search_path=teste_tmp_…`
//      SOZINHO, sem `public` na cauda (a armadilha está escrita em
//      `banco-descartavel.ts`: com `public` atrás, `current_schema()` mente);
//   2. NENHUMA migração cita schema explicitamente — conferido por busca em
//      `migrations/*.sql`: nada de `public.`, nada de `set search_path`;
//   3. a conferência do próprio script usa `to_regclass`, que resolve pelo
//      `search_path` — ela fotografa o schema temporário, não o `public`;
//   4. o schema morre no fim, e `rede-global.ts` derruba a rodada se sobrar.
import { afterAll, beforeAll, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import {
  conferirCaminho,
  criarSchema,
  destruirSchema,
  novoNomeDeSchema,
  urlComSchema,
  urlDoBanco,
} from "./banco-descartavel";
import { migracoesEmOrdem } from "./migracoes";
// `somaDoTexto` é a MESMA função que o script usa para assinar: repor a linha do
// registro com outra assinatura faria o script acusar "migração editada".
import { somaDoTexto } from "../scripts/migracoes.mjs";
import { sslDaUrl } from "@/lib/conexao";

const rodar = promisify(execFile);
const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const URL_ORIGINAL = urlDoBanco();

let schema: string | null = null;
let urlDoTeste = "";
let leitor: postgres.Sql | null = null;

beforeAll(async () => {
  schema = novoNomeDeSchema();
  await criarSchema(schema);
  urlDoTeste = urlComSchema(URL_ORIGINAL, schema);
  leitor = postgres(urlDoTeste, { prepare: false, ssl: sslDaUrl(urlDoTeste), max: 1 });
  // A trava de `banco-descartavel`: confere NO BANCO que o caminho é o schema
  // temporário sozinho. Se esta linha passar, nada abaixo alcança `public`.
  await conferirCaminho((texto) => leitor!.unsafe(texto), schema);
}, 120_000);

afterAll(async () => {
  await leitor?.end();
  if (schema) await destruirSchema(schema);
});

/** Roda `scripts/migrar.mjs` como o build roda, contra o schema descartável. */
async function migrar(...bandeiras: string[]) {
  try {
    const { stdout } = await rodar("node", ["scripts/migrar.mjs", ...bandeiras], {
      cwd: RAIZ,
      // `--a-mao` é o que o script exige fora de um deploy, e ele conferiu que
      // existe `.env.local`. A URL vem do AMBIENTE, e o script prefere o
      // ambiente ao arquivo — é assim que o schema temporário entra.
      env: { ...process.env, DATABASE_URL: urlDoTeste, VERCEL_ENV: "" },
      maxBuffer: 20e6,
    });
    return { saida: stdout, codigo: 0 };
  } catch (erro) {
    const e = erro as { stdout?: string; stderr?: string; code?: number };
    return { saida: `${e.stdout ?? ""}${e.stderr ?? ""}`, codigo: e.code ?? 1 };
  }
}

const QUANTAS = migracoesEmOrdem().length;

it("a PRIMEIRA rodada aplica tudo e anota, e a SEGUNDA não aplica nada", async () => {
  const primeira = await migrar("--aplicar", "--a-mao");
  expect(primeira.codigo, primeira.saida).toBe(0);

  // Todas aplicadas, e o "registrada" é o que separa esta versão da anterior.
  const aplicadas = [...primeira.saida.matchAll(/aplicada e registrada/g)].length;
  expect(aplicadas, primeira.saida).toBe(QUANTAS);

  // O registro existe e tem uma linha por arquivo, com assinatura.
  const anotadas = await leitor!`select name, checksum from schema_migrations order by name`;
  expect(anotadas.map((r) => r.name)).toEqual(migracoesEmOrdem().map((m) => m.nome));
  for (const r of anotadas) expect(r.checksum).toMatch(/^[0-9a-f]{64}$/);

  // ===== A SEGUNDA RODADA — o motivo deste arquivo existir =====
  const segunda = await migrar("--aplicar", "--a-mao");
  expect(segunda.codigo, segunda.saida).toBe(0);

  // NADA aplicado: é isto que faz o deploy parar de pedir trava exclusiva.
  expect(segunda.saida).not.toContain("aplicada e registrada");
  expect(segunda.saida).toContain("Nada a aplicar");
  expect([...segunda.saida.matchAll(/já aplicada, nada a fazer/g)].length).toBe(QUANTAS);

  // E ela continua CONFERINDO o banco: pular o trabalho não é pular o exame.
  expect(segunda.saida).toContain("CONFERIDO no banco");
}, 240_000);

it("migração EDITADA depois de aplicada faz o script PARAR, sem aplicar nada", async () => {
  // O registro já está preenchido pelo caso acima. Estragar a assinatura de uma
  // linha é indistinguível, para o script, de alguém ter editado o arquivo.
  await leitor!`update schema_migrations set checksum = 'assinatura-de-outro-texto'
                 where name = ${migracoesEmOrdem()[0].nome}`;

  const r = await migrar("--aplicar", "--a-mao");

  expect(r.codigo, r.saida).toBe(1);
  expect(r.saida).toContain("PAROU");
  expect(r.saida).toContain(migracoesEmOrdem()[0].nome);
  // E NÃO aplicou nada — nem as que estavam em ordem. A pergunta "este banco
  // está no estado que a pasta descreve?" ficou sem resposta, e aplicar mais
  // coisas por cima só afundaria o descompasso.
  expect(r.saida).not.toContain("aplicada e registrada");

  // Devolve o registro ao lugar, para não contaminar quem rodar depois.
  await leitor!`delete from schema_migrations where name = ${migracoesEmOrdem()[0].nome}`;
}, 120_000);

it("DADO velho que sobrou derruba o script, mesmo com a migração já registrada", async () => {
  // A CONFERÊNCIA DE DADO (`ESPERADAS_DADOS`, scripts/migrar.mjs) medida pelo
  // único caminho que a alcança de verdade.
  //
  // Os casos acima provam que a segunda rodada NÃO APLICA nada — e é justamente
  // por isso que este caso existe: com a `012` já registrada, o script pula o
  // `update` e a única coisa que ainda olha para o dado é a conferência. Se ela
  // não estivesse lá, o script imprimiria cinco "CONFERIDO" sobre estrutura e
  // sairia 0 com passos `pedir_email` vivos no banco — que é exatamente o
  // estado em que `interpretar` (lib/steps.ts) IGNORA o bloco e o fluxo entrega
  // o que vem depois do pedido sem nunca ter pedido nada.
  //
  // O ESTADO DE PARTIDA É REPOSTO ANTES, e isto não é zelo: o caso acima termina
  // APAGANDO a linha de `000` do registro, então sem esta reposição o script
  // REAPLICARIA `000` no meio deste caso — e `000` recria as duas colunas que a
  // `006` remove (que continua registrada e não roda de novo). A conferência de
  // ausência passaria a falhar junto, e este caso estaria medindo duas coisas,
  // uma delas alheia. Repor a linha com a assinatura certa é o mesmo que o
  // script faria numa aplicação normal.
  const base = migracoesEmOrdem()[0];
  await leitor!`
    insert into schema_migrations (name, checksum) values (${base.nome}, ${somaDoTexto(base.comandos)})
    on conflict (name) do update set checksum = excluded.checksum`;

  // Semear À MÃO é o que imita "um banco que não recebeu a migração": o registro
  // diz que ela rodou, e o dado diz que não.
  await leitor!`
    insert into automations (account_id, name, active, triggers, keywords, steps)
    values ('17800000000000012', 'automacao que ficou para tras', true,
            string_to_array('dm', ','), string_to_array('x', ','),
            '[{"id":"b_velho1","tipo":"pedir_email","texto":"seu e-mail?"}]'::jsonb)`;

  const r = await migrar("--aplicar", "--a-mao");

  expect(r.codigo, r.saida).toBe(1);
  // A MENSAGEM É COBRADA, e não só o código: um script que saísse 1 por outro
  // motivo passaria neste caso sem ter olhado para o dado uma vez.
  expect(r.saida).toContain("SOBRARAM 1");
  expect(r.saida).toContain("pedir_email");
  expect(r.saida).toContain("012-migrar-email-para-campos.sql");
  // E O CONSELHO, que desde a revisão da Tarefa 7 é POR ENTRADA (`seSobrar`,
  // scripts/migrar.mjs) e não mais uma frase única do laço. Para esta metade o
  // conselho certo é este: o `update` não casou nada, e o que se investiga é a
  // migração. Para o passo migrado SEM TEXTO o conselho é o oposto, e o caso
  // abaixo cobra o outro — juntos, eles provam que as frases não se misturaram.
  expect(r.saida).toContain("A MIGRAÇÃO DE DADO NÃO FEZ EFEITO");
  // E ele NÃO aplicou nada: a migração continua registrada, e o conserto é de
  // quem for investigar — não do script rodando de novo por cima.
  expect(r.saida).not.toContain("aplicada e registrada");

  // Limpa, para não contaminar quem rodar depois neste mesmo schema.
  await leitor!`delete from automations where name = 'automacao que ficou para tras'`;
  const depois = await migrar("--aplicar", "--a-mao");
  expect(depois.codigo, depois.saida).toBe(0);
}, 240_000);

it("passo que MIGROU e ficou SEM TEXTO derruba o script; o que tem texto, não", async () => {
  // O BURACO QUE A REVISÃO DA TAREFA 7 ACHOU (achado 1), medido pelo único
  // caminho que o alcança de verdade — o script, como processo, contra um banco.
  //
  // A conferência antiga perguntava só "sobrou algum `pedir_email`?". Um
  // `pedir_email` SEM TEXTO vira `pedir_dado` SEM TEXTO, e aí a pergunta antiga
  // responde "não sobrou nenhum": ela olha o TIPO e não o que `interpretar`
  // (lib/steps.ts) faz com o bloco. Medido pela revisão no arranjo de produção
  // `[dm oi, pedido, dm link]`: o passo migrado sem texto enfileira
  // `["oi!","AQUI ESTA O LINK"]` — saída IDÊNTICA à do não migrado. O link sai
  // sem nunca ter pedido nada, e o script saía 0 com o build verde.
  //
  // OS DOIS BLOCOS SÃO DE PROPÓSITO, e o segundo é metade do caso: se a consulta
  // perdesse a condição de texto, ela contaria também o `pedir_dado` LEGÍTIMO e
  // cobraria 2 — e uma conferência assim ficaria vermelha em todo deploy, contra
  // o dado são que a Tarefa 5 grava. A asserção cobra 1, e não "maior que zero".
  //
  // PRECONDIÇÃO, a mesma dos casos acima: a `012` já está REGISTRADA, então o
  // script pula o `update` e a única coisa que ainda olha para o dado é a
  // conferência. É por isso que semear à mão imita "um banco que não recebeu a
  // migração" sem que o script conserte o estado antes de medi-lo.
  await leitor!`
    insert into automations (account_id, name, active, triggers, keywords, steps)
    values ('17800000000000012', 'migrado e ainda ignorado', true,
            string_to_array('dm', ','), string_to_array('x', ','),
            '[{"id":"b_sem_texto","tipo":"pedir_dado","campo":"email"}]'::jsonb)`;
  await leitor!`
    insert into automations (account_id, name, active, triggers, keywords, steps)
    values ('17800000000000012', 'migrado e funcionando', true,
            string_to_array('dm', ','), string_to_array('x', ','),
            '[{"id":"b_com_texto","tipo":"pedir_dado","campo":"email","texto":"seu e-mail?"}]'::jsonb)`;

  const r = await migrar("--aplicar", "--a-mao");

  expect(r.codigo, r.saida).toBe(1);
  // A CONTA É COBRADA JUNTO COM A FRASE: "SOBRARAM 2" aqui seria a consulta
  // larga demais, varrendo o bloco são junto com o quebrado.
  expect(r.saida).toContain("SOBRARAM 1 passos `pedir_dado` SEM TEXTO");
  expect(r.saida).toContain("012-migrar-email-para-campos.sql");
  // E O CONSELHO TEM DE SER O CERTO. Para este achado, "A MIGRAÇÃO DE DADO NÃO
  // FEZ EFEITO" é conselho errado: ela FEZ efeito, e rodá-la de novo não
  // inventa o texto que falta. Quem conserta é o editor.
  expect(r.saida).toContain("O BLOCO MIGROU E CONTINUA SENDO IGNORADO");
  expect(r.saida).not.toContain("A MIGRAÇÃO DE DADO NÃO FEZ EFEITO");
  expect(r.saida).not.toContain("aplicada e registrada");

  await leitor!`delete from automations where name in ('migrado e ainda ignorado', 'migrado e funcionando')`;
  const depois = await migrar("--aplicar", "--a-mao");
  expect(depois.codigo, depois.saida).toBe(0);
}, 240_000);

it("CONTATO com e-mail na coluna e sem `campos` derruba o script", async () => {
  // A OUTRA METADE DE `ESPERADAS_DADOS`, e este caso existe porque até a revisão
  // da Tarefa 7 ela era GUARDA ÓRFÃ: apagando só aquela entrada, a suíte de
  // integração inteira ficava verde (238 passaram / 8 pulados, idêntico à linha
  // de base). O caso acima a deixava passar porque a metade das AUTOMAÇÕES já
  // imprimia "SOBRARAM 1" e "pedir_email" — as duas frases que ele cobra.
  //
  // As duas metades da migração falham de jeitos DIFERENTES: um `update` de
  // contatos que casasse zero linhas deixaria esta conferência vermelha
  // enquanto a das automações ficaria verde. É essa diferença que este caso
  // prende, e é por isso que ele cobra a frase de CONTATOS, e não "SOBRARAM 1"
  // sozinho, que a outra metade também imprime.
  //
  // `first_contact_at` e `campos` saem dos padrões da coluna (`now()` e `{}`) —
  // o que importa aqui é e-mail preenchido na coluna e `campos` sem a chave.
  await leitor!`
    insert into contacts (account_id, ig_id, email)
    values ('17800000000000012', 'ig_contato_que_ficou_para_tras', 'quem@ficou.para.tras')`;

  const r = await migrar("--aplicar", "--a-mao");

  expect(r.codigo, r.saida).toBe(1);
  expect(r.saida).toContain("SOBRARAM 1 contatos com e-mail na coluna");
  expect(r.saida).toContain("012-migrar-email-para-campos.sql");
  expect(r.saida).toContain("A MIGRAÇÃO DE DADO NÃO FEZ EFEITO");
  expect(r.saida).not.toContain("aplicada e registrada");

  await leitor!`delete from contacts where ig_id = 'ig_contato_que_ficou_para_tras'`;
  const depois = await migrar("--aplicar", "--a-mao");
  expect(depois.codigo, depois.saida).toBe(0);
}, 240_000);

it("o registro nasce no schema descartável, e NÃO no public", async () => {
  const [r] = await leitor!`
    select n.nspname as schema
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relname = 'schema_migrations' and n.nspname = ${schema!}`;
  expect(r?.schema).toBe(schema);
}, 60_000);
