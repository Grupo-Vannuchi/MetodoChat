// A MIGRAÇÃO DO QUE JÁ EXISTE — `012-migrar-email-para-campos.sql`, medida
// contra um banco com dado dentro.
//
// POR QUE ESTE ARQUIVO EXISTE, e por que ele não podia ser um caso a mais em
// `esquema-de-partida.integracao.ts`: todas as onze migrações anteriores mudam
// ESTRUTURA, e estrutura é conferida num schema VAZIO — é exatamente isso que o
// harness monta. A `012` é a primeira que mexe em DADO, e um schema vazio não
// tem o que ela toca. Rodá-la contra zero linhas é verde sobre nada.
//
// Então aqui a ordem é outra: o harness monta a estrutura (a `012` roda e não
// acha nada), o caso SEMEIA o estado antigo, e só então a `012` é aplicada de
// novo, com o texto lido da própria pasta. Nenhuma linha de SQL é copiada para
// cá — o que se prova é o arquivo que o deploy vai executar, e não uma
// transcrição dele que pode divergir.
//
// -----------------------------------------------------------------------------
// O QUE ESTÁ EM JOGO, e é produção de verdade
//
// As automações ATIVAS em produção têm `tipo: "pedir_email"` gravado, e a `012`
// é quem as põe no formato novo.
//
// O QUE ESTE PARÁGRAFO DIZIA ATÉ 23/09/2026: que `conferir` (lib/steps.ts)
// RECUSAVA `pedir_email`, e que publicar a branch antes da migração
// transformaria esses blocos em "Este bloco é de um tipo que o sistema não
// reconhece" — ignorados por `interpretar`, com o fluxo entregando o link sem
// ter pedido nada. Era verdade, e era metade da história: a outra metade é que
// o código VELHO, servindo durante o deploy, faz a MESMA coisa com o passo já
// migrado. A janela vazava o link nas duas direções.
//
// O QUE MUDOU: `conferir` passou a aceitar `pedir_email` como APELIDO de
// `pedir_dado { campo: "email" }`, e a `012` saiu do build para ser aplicada à
// mão depois do deploy (`docs/deploy/2026-09-23-a-012-sai-do-build.md`). Os dois
// formatos funcionam ao mesmo tempo, em qualquer ordem.
//
// E O CASO QUE MAIS IMPORTA AQUI CONTINUA SENDO O MESMO: não é "o jsonb ficou
// com a cara certa", é "o passo migrado PASSA no `conferir` de hoje". Olhar o
// jsonb e achar que está bom é a forma deste defeito sobreviver ao teste — e o
// apelido não cobre este caso, porque ele traduz o tipo VELHO, e aqui o que se
// mede é o que a migração ESCREVEU.
//
// -----------------------------------------------------------------------------
// O `em` DOS E-MAILS MIGRADOS É O INSTANTE DA MIGRAÇÃO, E ISSO É DECISÃO DO DONO
//
// ESTE BLOCO DIZIA O CONTRÁRIO, e a correção fica escrita porque foi ela que
// inverteu dois casos deste arquivo. A `012` gravava `em = first_contact_at`, e
// o caso de baixo cobrava a consequência: `campoEstaFresco` (lib/campos.ts)
// recusa coleta com mais de 30 dias, então a automação PERGUNTAVA o e-mail de
// novo a quem já o tinha — 9 contatos de 163, medido em produção.
//
// O DONO NÃO QUER ESSAS 9 PESSOAS PERGUNTADAS DE NOVO. A `012` passou a gravar
// `now()`, e é isso que os casos daqui prendem: a string tem de apontar para o
// instante em que a migração RODOU, e `campoEstaFresco` tem de dizer FRESCO
// logo depois dela.
//
// O QUE SE PERDEU, e um caso daqui o mede: a data deixou de ser um FATO sobre a
// coleta e virou um SUBSTITUTO. Quem ler `em` nesses registros não está lendo
// "foi coletado nesse dia" — está lendo "a migração passou nesse dia". O
// discriminador é a chave `automacao`: a `012` NÃO a grava, `gravarCampo`
// (lib/engine.ts) SEMPRE grava. E o preço é prazo, não perdão: daqui a 30 dias
// essa data envelhece e essas mesmas pessoas entram na fila de pergunta. A
// troca ADIA, não elimina — e há caso para as duas pontas.
//
// -----------------------------------------------------------------------------
// O FUSO CONTINUA SENDO PARÂMETRO, E ISSO É O CORAÇÃO DE METADE DOS CASOS
//
// `now()` é `timestamptz`, como `first_contact_at` era. `to_char` SEM `at time
// zone 'utc'` imprime no fuso da SESSÃO e o `"Z"` do formato é literal — a
// string sai dizendo "UTC" sobre um horário que não é UTC. Medido neste
// container: com a sessão em `America/Sao_Paulo`, o instante sai TRÊS HORAS
// atrás do que ele é, com o `Z` colado no fim. `campoEstaFresco` faz
// `Date.parse` disso e acredita no `Z`.
//
// Os casos daqui rodam a migração com a sessão num fuso DIFERENTE de UTC de
// propósito. Com a sessão em UTC — que é o que este container usa por omissão —
// o defeito fica invisível, e o caso ficaria verde sobre nada.
//
// E A JANELA É MEDIDA CONTRA O RELÓGIO DO BANCO, e não o do Node: quem grava é
// `now()`, lá dentro. Cravar a janela com `Date.now()` daqui faria o caso
// depender de o relógio do container e o da máquina estarem juntos — uma
// terceira coisa, que não é o que se quer provar.
import { beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import { migracoesEmOrdem } from "./migracoes";
// `lib/campos.ts` e `lib/steps.ts` são módulos que não falam com o banco: podem
// ser importados no topo, como `gatilho-entrega.integracao.ts` já faz.
import { campoEstaFresco, lerCampos } from "@/lib/campos";
import { conferir, conferirLista } from "@/lib/steps";

const banco = bancoDescartavel();

const CONTA = "17800000000000012";

// O ARQUIVO É LIDO DA PASTA, e o nome é cobrado: se alguém o renumerar, este
// `find` devolveria `undefined` e os casos falhariam com "cannot read property
// comandos of undefined" — erro que não diz nada. A mensagem abaixo diz.
const NOME_DA_MIGRACAO = "012-migrar-email-para-campos.sql";

function textoDaMigracao(): string {
  const achada = migracoesEmOrdem().find((m) => m.nome === NOME_DA_MIGRACAO);
  if (!achada) {
    throw new Error(
      `migrations/${NOME_DA_MIGRACAO} não está na pasta. Este arquivo prova ` +
        `ESSA migração; sem ela não há o que provar.`
    );
  }
  return achada.comandos;
}

/**
 * Roda a migração dos dados com a sessão num fuso escolhido.
 *
 * O `set time zone` vai NA MESMA string do SQL de propósito: `sql().query` cai
 * em `cliente.unsafe(texto)` sem parâmetros (lib/db.ts), que usa o protocolo
 * simples e executa tudo numa conexão só. Mandar o `set` numa chamada separada
 * daria a conexão do pool que der, e o fuso poderia não ser o da migração — o
 * caso ficaria verde por sorte.
 */
async function rodarMigracao(fuso: string = "America/Sao_Paulo"): Promise<void> {
  await banco.db().sql().query(`set time zone '${fuso}';\n${textoDaMigracao()}`);
}

/**
 * O instante do BANCO, em milissegundos, sem passar por fuso nenhum.
 *
 * `extract(epoch from now())` devolve o instante ABSOLUTO: ele não muda com o
 * `set time zone` da sessão, e por isso pode ser a régua de um caso cujo assunto
 * é justamente o fuso. Medir a janela com `to_char(...)` seria medir a coisa com
 * ela mesma — o defeito do `at time zone 'utc'` ausente apareceria dos dois
 * lados e se cancelaria.
 */
async function epocaDoBanco(): Promise<number> {
  const linhas = (await banco
    .db()
    .sql()
    .query(`select extract(epoch from now())::float8 as agora`)) as { agora: number }[];
  return Number(linhas[0].agora) * 1000;
}

/** Um contato do jeito que produção o tem HOJE: e-mail na coluna, `campos` vazio. */
async function semearContatoLegado(
  igId: string,
  email: string | null,
  primeiroContato: Date,
  campos: Record<string, unknown> = {}
): Promise<void> {
  await banco
    .db()
    .sql()
    .query(
      `insert into contacts (account_id, ig_id, email, first_contact_at, campos)
       values ($1, $2, $3, $4::timestamptz, $5::text::jsonb)`,
      [CONTA, igId, email, primeiroContato.toISOString(), JSON.stringify(campos)]
    );
}

async function lerContato(
  igId: string
): Promise<{ campos: unknown; email: string | null; xmin: string }> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select campos, email, xmin::text as xmin from contacts
        where account_id = $1 and ig_id = $2`,
      [CONTA, igId]
    )) as { campos: unknown; email: string | null; xmin: string }[];
  return linhas[0];
}

async function semearAutomacao(nome: string, steps: unknown): Promise<string> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `insert into automations (account_id, name, active, triggers, keywords, steps)
       values ($1, $2, true, string_to_array('dm', ','), string_to_array('x', ','),
               $3::text::jsonb)
       returning id`,
      [CONTA, nome, JSON.stringify(steps)]
    )) as { id: string }[];
  return linhas[0].id;
}

/**
 * Os `steps` e o `xmin` da linha.
 *
 * `xmin` É A PROVA DE QUE A LINHA NÃO FOI ESCRITA, e não uma curiosidade: ele é
 * o id da transação que gravou a versão atual da tupla, e um `update` o muda
 * MESMO quando o valor novo é igual ao velho. Comparar só o jsonb não separa
 * "não foi tocada" de "foi reescrita com o mesmo conteúdo" — e é exatamente
 * essa diferença que dois casos daqui cobram.
 */
async function lerAutomacao(id: string): Promise<{ steps: unknown[]; xmin: string }> {
  const linhas = (await banco
    .db()
    .sql()
    .query(`select steps, xmin::text as xmin from automations where id = $1`, [id])) as {
    steps: unknown[];
    xmin: string;
  }[];
  return linhas[0];
}

beforeAll(() => {
  // O harness já aplicou a pasta inteira num schema vazio — a `012` inclusive,
  // sem nada para migrar. Daqui para baixo cada caso semeia o seu estado antigo.
});

describe("os e-mails que já estão na coluna", () => {
  test("viram campo coletado, com o instante da MIGRAÇÃO escrito em UTC", async () => {
    // O `first_contact_at` é cravado NO PASSADO de propósito, e é ele que a
    // migração gravava até esta tarefa. Ele fica aqui como o valor que o `em`
    // NÃO pode mais ser: se alguém devolver o `first_contact_at` ao
    // `jsonb_build_object`, a janela de baixo não o alcança e o caso acusa.
    const primeiroContato = new Date("2026-06-10T12:00:00.000Z");
    await semearContatoLegado("legado_utc", "ana@email.com", primeiroContato);

    // A JANELA, PELO RELÓGIO DO BANCO. O `to_char` do formato corta o
    // subsegundo, então o piso é o segundo INTEIRO de `antes`: um `now()` de
    // 12:00:00.900 sai como `12:00:00Z`, que é anterior a um `antes` de
    // 12:00:00.800 e não seria defeito nenhum.
    const antes = await epocaDoBanco();

    // A sessão NÃO está em UTC: é isto que separa este caso de um que passa por
    // acidente. Ver o bloco do topo.
    await rodarMigracao("America/Sao_Paulo");

    const depois = await epocaDoBanco();

    const registro = lerCampos((await lerContato("legado_utc")).campos);
    const email = registro.get("email");
    expect(email, "o e-mail da coluna não virou campo coletado").toBeDefined();
    expect(email!.valor).toBe("ana@email.com");

    // A FORMA é a mesma que `gravarCampo` (lib/engine.ts) grava hoje — e agora
    // a EXPRESSÃO também é, `to_char(now() at time zone 'utc', ...)`, letra por
    // letra. Duas formas diferentes para o mesmo campo seriam duas verdades
    // sobre o que `Date.parse` recebe.
    expect(email!.em).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

    // O CASO INTEIRO ESTÁ NESTAS DUAS LINHAS, e elas cobram DOIS defeitos de uma
    // vez, porque os dois deslocam a mesma string para o passado:
    //
    //   · o `em` voltando a `first_contact_at` — aponta para junho, meses antes
    //     da janela;
    //   · o `at time zone 'utc'` saindo — com a sessão em `America/Sao_Paulo`,
    //     aponta TRÊS HORAS antes da janela, com o `Z` mentindo no fim.
    const gravado = Date.parse(email!.em);
    const piso = Math.floor(antes / 1000) * 1000;
    expect(
      gravado,
      `o \`em\` gravado (${email!.em}) é ANTERIOR ao começo da migração — ` +
        `esperado o instante em que ela rodou, em UTC`
    ).toBeGreaterThanOrEqual(piso);
    expect(
      gravado,
      `o \`em\` gravado (${email!.em}) é POSTERIOR ao fim da migração — ` +
        `esperado o instante em que ela rodou, em UTC`
    ).toBeLessThanOrEqual(depois);

    // E O QUE SOBRA DO `first_contact_at`: nada. A linha existe para que a
    // mensagem de cima não seja a única a dizer de onde vinha a data velha.
    expect(gravado, "o `em` voltou a ser o `first_contact_at`").not.toBe(
      primeiroContato.getTime()
    );
  });

  test("o contato NÃO é perguntado de novo logo depois da migração — e volta à fila em 30 dias", async () => {
    // A DECISÃO QUE ESTE CASO PRENDE, E ELA É DO DONO. Este caso cobrava o
    // CONTRÁRIO: que o `em` fosse `first_contact_at` e que `campoEstaFresco`
    // dissesse "não é fresco", com o comentário explicando que chutar data
    // recente faria a recência pular o pedido de quem talvez precise atualizar o
    // e-mail. O dono trocou: ele não quer as 9 pessoas medidas em produção
    // perguntadas de novo. Quem quiser o histórico dessa troca lê o bloco do
    // topo deste arquivo e o de `migrations/012`.
    //
    // A distância é contada a partir de `Date.now()`, e nunca de uma data
    // escrita à mão: em 21/09/2026 dois testes desta base ficaram vermelhos
    // sozinhos por cravarem data que passou.
    const agora = Date.now();
    const duzentosDiasAtras = new Date(agora - 200 * 24 * 60 * 60 * 1000);
    await semearContatoLegado("legado_antigo", "bia@email.com", duzentosDiasAtras);

    await rodarMigracao();

    const registro = lerCampos((await lerContato("legado_antigo")).campos);
    const em = registro.get("email")!.em;

    // O CONTATO TEM 200 DIAS E O CAMPO SAI FRESCO. É a decisão inteira numa
    // linha: a idade da PESSOA deixou de decidir a idade do DADO.
    expect(
      campoEstaFresco(em, agora),
      `o \`em\` gravado (${em}) não está fresco agora — a automação vai ` +
        `perguntar o e-mail de novo, que é exatamente o que a troca evita`
    ).toBe(true);

    // O PREÇO, PRENDIDO: a troca ADIA, não elimina. Trinta dias e um minuto
    // depois da migração, `campoEstaFresco` volta a dizer "não" e estas mesmas
    // pessoas entram na fila de pergunta. Sem esta linha, o arquivo prometeria
    // um perdão que ele não dá.
    const trintaDiasEUmMinuto = 30 * 24 * 60 * 60 * 1000 + 60 * 1000;
    expect(
      campoEstaFresco(em, agora + trintaDiasEUmMinuto),
      `o \`em\` gravado (${em}) continua fresco 30 dias depois — a recência ` +
        `de \`campoEstaFresco\` deixou de valer para o dado migrado`
    ).toBe(false);
  });

  test("o registro migrado NÃO tem a chave `automacao` — é o que o distingue de uma coleta de verdade", async () => {
    // O DISCRIMINADOR, E ELE É A ÚNICA COISA QUE SOBROU DA HONESTIDADE DA DATA.
    //
    // Desde que o `em` virou o instante da migração, a data não distingue mais
    // nada: um registro migrado e um coletado hoje têm `em` parecidos. Quem os
    // separa é a AUSÊNCIA de `automacao` — `gravarCampo` (lib/engine.ts) SEMPRE
    // grava a chave (com `null` quando não há automação, mas grava), e a `012`
    // NUNCA a grava. A revisão da Tarefa 7 usou exatamente isso na consulta C7.
    //
    // A chave é opcional em `CampoColetado` (lib/campos.ts) desde a `011`, e o
    // comentário daquela migração diz que a opcionalidade existe para ESTES
    // contatos. Este caso é o que impede alguém de "completar" o registro com
    // um `'automacao', null` bem-intencionado: seria apagar o único sinal de
    // que a data é um substituto.
    await semearContatoLegado("sem_automacao", "hel@email.com", new Date("2026-03-01T09:00:00.000Z"));

    await rodarMigracao();

    const bruto = (await lerContato("sem_automacao")).campos as Record<
      string,
      Record<string, unknown>
    >;
    expect(
      Object.keys(bruto.email).sort(),
      "o registro migrado ganhou uma chave que o faria passar por coleta de verdade"
    ).toEqual(["em", "valor"]);
  });

  test("um `campos` que já tem OUTRO campo não é apagado pela migração", async () => {
    // O PLANTIO ÓBVIO DESTA MIGRAÇÃO, e é o mesmo de `gravarCampo`
    // (lib/engine.ts): `set campos = jsonb_build_object(...)` SUBSTITUI o objeto
    // inteiro, e `campos || jsonb_build_object(...)` MESCLA. Trocando o `||` por
    // `=`, este caso acusa — e sem ele a troca fica verde.
    //
    // O caminho não é hipotético: `not (campos ? 'email')` deixa passar todo
    // contato que tenha telefone, nascimento ou campo livre coletados e não
    // tenha e-mail. No dia do deploy `campos` está vazio para todos (a coluna
    // acabou de nascer, migração 011), mas a migração TEM de ser reexecutável —
    // e numa segunda execução, semanas depois, esse contato existe.
    const jaColetado = {
      telefone: { valor: "11999998888", em: "2026-09-20T10:00:00Z", automacao: null },
    };
    await semearContatoLegado(
      "legado_com_telefone",
      "dud@email.com",
      new Date("2026-03-03T08:00:00.000Z"),
      jaColetado
    );

    await rodarMigracao();

    const registro = lerCampos((await lerContato("legado_com_telefone")).campos);
    expect(registro.get("telefone")?.valor, "a migração APAGOU o telefone já coletado").toBe(
      "11999998888"
    );
    expect(registro.get("email")?.valor).toBe("dud@email.com");
  });

  test("um contato SEM e-mail continua sem campo nenhum", async () => {
    await semearContatoLegado("sem_email", null, new Date("2026-05-05T05:00:00.000Z"));
    await rodarMigracao();
    expect(lerCampos((await lerContato("sem_email")).campos).size).toBe(0);
  });

  test("e-mail vazio na coluna NÃO vira campo coletado", async () => {
    // `where email is not null` deixa passar a string vazia, e o resultado seria
    // um campo "coletado" com `valor: ""` — um dado que o sistema afirma ter e
    // que não existe. `{{email}}` sairia vazio numa mensagem com cara de
    // preenchida. A coluna não tem `check` que impeça o vazio, e o único
    // escritor de hoje (`gravarCampo`, lib/engine.ts) não é o único que existiu.
    await semearContatoLegado("email_vazio", "   ", new Date("2026-05-05T05:00:00.000Z"));
    await rodarMigracao();
    expect(lerCampos((await lerContato("email_vazio")).campos).has("email")).toBe(false);
  });

  test("um e-mail coletado DEPOIS não é sobrescrito pelo da coluna", async () => {
    // O QUE `not (campos ? 'email')` PROTEGE, e não é "não duplicar": é a DATA.
    // O ESTRAGO MUDOU DE LADO com a troca do `em`, e a correção fica escrita
    // porque a versão anterior deste parágrafo virou mentira.
    //
    // ELE DIZIA: sem esta metade do `where`, a segunda execução reescreveria o
    // `em` para `first_contact_at`, a data voltaria meses, `campoEstaFresco`
    // diria "não é fresco" e a automação pediria o e-mail a quem acabou de
    // mandar. Era verdade enquanto a migração gravava `first_contact_at`.
    //
    // HOJE ELA GRAVA `now()`, e o estrago é o ESPELHO: a data não voltaria, ela
    // PULARIA PARA A FRENTE. Um registro coletado de verdade — com `em` real e
    // com a chave `automacao` — seria trocado por um substituto sem `automacao`,
    // e a cada reexecução o campo voltaria a nascer fresco. O dado continuaria
    // certo e a única coisa que dizia "isto foi coletado, nesta data, por esta
    // automação" teria sido apagada por uma migração de limpeza de formato.
    //
    // `gravarCampo` (lib/engine.ts) escreve nos DOIS lugares — `campos` e a
    // coluna —, então um contato que respondeu ontem tem o mesmo e-mail nos
    // dois, com `em` de ontem no registro. É esse `em` que esta metade do
    // `where` preserva.
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 19) + "Z";
    await semearContatoLegado(
      "coletado_depois",
      "gil@email.com",
      new Date("2026-01-01T01:00:00.000Z"),
      { email: { valor: "gil@email.com", em: ontem, automacao: null } }
    );

    await rodarMigracao();

    const registro = lerCampos((await lerContato("coletado_depois")).campos);
    expect(
      registro.get("email")!.em,
      "a migração trocou a data de uma coleta de verdade pelo instante dela mesma"
    ).toBe(ontem);
    expect(campoEstaFresco(registro.get("email")!.em, Date.now())).toBe(true);
    // E a `automacao` continua lá: é ela que diz que este registro foi COLETADO,
    // e não migrado. Uma sobrescrita a levaria junto com a data.
    const bruto = (await lerContato("coletado_depois")).campos as Record<
      string,
      Record<string, unknown>
    >;
    expect(
      "automacao" in bruto.email,
      "a migração apagou a chave `automacao` de uma coleta de verdade"
    ).toBe(true);
  });

  test("a coluna `contacts.email` CONTINUA intacta — a remoção é do Passo 2b", async () => {
    // A `012` COPIA, E NÃO MOVE, e isso não mudou com o Passo 2a. Quando ela foi
    // escrita, a janela estava aberta de propósito — havia leitores da coluna, e
    // `gravarCampo` escrevia nos dois lugares —, e uma migração que "mudasse o
    // dado de lugar" apagando a coluna quebraria todos eles, calada.
    //
    // HOJE NINGUÉM LÊ A COLUNA, e a razão de a migração não a apagar é outra, e
    // continua valendo: quem derruba a coluna é o `drop column` do Passo 2b,
    // aplicado À MÃO pelo dono, depois de este código estar no ar. Enquanto o
    // deploy não é promovido, o código VELHO ainda serve e ainda LÊ a coluna —
    // uma migração que a apagasse quebraria o que está no ar, e é exatamente o
    // que separar os dois passos existe para impedir.
    await semearContatoLegado("coluna_fica", "eva@email.com", new Date("2026-04-04T04:00:00.000Z"));
    await rodarMigracao();
    expect((await lerContato("coluna_fica")).email).toBe("eva@email.com");
  });
});

describe("os passos `pedir_email` das automações", () => {
  test("viram `pedir_dado` de e-mail, guardando id, texto e posição, e na MESMA ordem", async () => {
    const id = await semearAutomacao("a que pede e-mail", [
      { id: "b_um0001", tipo: "dm", texto: "oi" },
      { id: "b_dois02", tipo: "pedir_email", texto: "me manda seu e-mail", pos: { x: 10, y: 20 } },
      { id: "b_tres03", tipo: "dm", texto: "valeu" },
    ]);

    await rodarMigracao();

    const { steps } = await lerAutomacao(id);
    // A ORDEM DO ARRAY É O FLUXO quando não há setas desenhadas (`interpretar`,
    // lib/steps.ts), e esta linha cobra que a migração a preserve.
    //
    // ELA NÃO É A GUARDA DO `order by ord`, e dizer que era seria mentira
    // medida: o plantio foi feito — a cláusula saiu do `jsonb_agg` — e a suíte
    // inteira ficou VERDE. `jsonb_array_elements` emite na ordem do array e o
    // agregado consome na ordem em que recebe, então não há entrada que
    // distinga as duas versões. A cláusula fica no SQL porque o Postgres não
    // PROMETE essa ordem (o porquê está em migrations/012), e não porque este
    // caso a defenda.
    expect(steps.map((p) => (p as { id: string }).id)).toEqual(["b_um0001", "b_dois02", "b_tres03"]);

    const pedido = steps[1] as Record<string, unknown>;
    expect(pedido.tipo).toBe("pedir_dado");
    expect(pedido.campo).toBe("email");
    // O TEXTO É DO DONO, e é o que a pessoa lê. Perdê-lo na migração faria
    // `conferir` recusar o bloco por "pedir_dado sem texto" — trocaríamos uma
    // quebra por outra.
    expect(pedido.texto).toBe("me manda seu e-mail");
    // O `id` é o que liga as setas e o que o cursor guarda: um id novo
    // desgarraria as ligações e perderia quem está no meio da conversa.
    expect(pedido.id).toBe("b_dois02");
    // A posição é só o desenho do quadro, mas perdê-la embaralha o editor de
    // quem abrir a automação depois do deploy.
    expect(pedido.pos).toEqual({ x: 10, y: 20 });
  });

  test("o passo migrado PASSA no `conferir` de hoje — e não só tem a cara certa", async () => {
    // ESTE É O CASO QUE JUSTIFICA A TAREFA, e ele mede o que a migração
    // ESCREVEU — não o que o apelido de `conferir` traduz na leitura (o apelido
    // cobre o tipo VELHO; aqui o passo já é o NOVO, e se a `012` o tivesse
    // escrito torto nada o salvaria).
    // Olhar o jsonb e achar que está bom é como este defeito sobreviveria: o
    // objeto pode ter todas as chaves certas e ainda ser recusado (um `campo`
    // fora do catálogo, por exemplo, sai daqui com forma perfeita).
    const id = await semearAutomacao("a que tem de passar", [
      { id: "b_pede01", tipo: "pedir_email", texto: "seu e-mail, por favor" },
      { id: "b_link01", tipo: "dm", texto: "aqui está o link" },
    ]);

    await rodarMigracao();

    const { steps } = await lerAutomacao(id);
    for (const passo of steps) {
      const { passo: aceito, motivo } = conferir(passo);
      expect(aceito, `o \`conferir\` recusou o passo migrado: ${motivo}`).toBeDefined();
    }

    // E a LISTA inteira, que é o que trava o salvar no editor. Um passo aceito
    // sozinho ainda pode deixar a lista com erro (chave repetida, portão sem
    // rótulo), e é a lista que o dono vê.
    const erros = conferirLista(steps, "dm", [], false).filter((p) => p.nivel === "erro");
    expect(erros, `a lista migrada tem erro: ${erros.map((e) => e.mensagem).join(" | ")}`).toEqual(
      []
    );
  });

  test("uma automação que só CITA a palavra num texto não é reescrita — nem o valor, nem a linha", async () => {
    // O `where steps::text like '%pedir_email%'` do rascunho casa também com
    // automação cuja MENSAGEM contenha a palavra. O `case` não reescreveria
    // nada, então o valor final seria igual — mas a LINHA seria regravada, e
    // "quase inócuo" não é inócuo: é uma escrita a mais numa tabela de
    // produção, numa migração que roda dentro do build.
    //
    // `xmin` é o que separa as duas coisas. Ver `lerAutomacao`.
    const steps = [
      { id: "b_texto1", tipo: "dm", texto: "o bloco pedir_email saiu da paleta do editor" },
    ];
    const id = await semearAutomacao("a que só fala do assunto", steps);
    const antes = await lerAutomacao(id);

    await rodarMigracao();

    const depois = await lerAutomacao(id);
    expect(depois.steps).toEqual(antes.steps);
    expect(depois.xmin, "a linha foi REGRAVADA sem precisar").toBe(antes.xmin);
  });

  test("`steps` que não é array não derruba a migração inteira", async () => {
    // `jsonb_array_elements` sobre objeto estoura com "cannot extract elements
    // from an object", e sobre escalar com "...from a scalar" — MEDIDO neste
    // container. Numa migração isso não é uma linha que falha: é o comando
    // inteiro que aborta, e com ele o `next build` e o deploy.
    //
    // A coluna é `jsonb not null default '[]'` e NÃO tem `check` de forma;
    // `conferirLista` (lib/steps.ts) já trata "A automação não tem lista de
    // blocos", ou seja, a própria base admite que a linha torta existe.
    await semearAutomacao("steps é objeto", { tipo: "pedir_email", texto: "torto" });
    await semearAutomacao("steps é escalar", "pedir_email");
    await semearAutomacao("steps é nulo de json", null);
    const boa = await semearAutomacao("a boa, depois das tortas", [
      { id: "b_boa001", tipo: "pedir_email", texto: "e-mail?" },
    ]);

    // Se a migração abortar, este `await` rejeita e o caso fica vermelho com a
    // mensagem do Postgres — que é a informação que interessa.
    await rodarMigracao();

    const { steps } = await lerAutomacao(boa);
    expect((steps[0] as Record<string, unknown>).tipo).toBe("pedir_dado");
  });

  test("uma automação de `steps` VAZIO não termina com `steps` nulo", async () => {
    // `jsonb_agg` sobre zero linhas devolve NULL — medido neste container — e a
    // coluna é `not null`. Se a lista de alvos alguma vez incluir uma automação
    // sem passos, o `update` inteiro morre com violação de not-null.
    const id = await semearAutomacao("a vazia", []);
    await rodarMigracao();
    expect((await lerAutomacao(id)).steps).toEqual([]);
  });
});

describe("rodar duas vezes", () => {
  test("não dobra dado, não desfaz o que a primeira fez, e não reescreve linha nenhuma", async () => {
    // A migração é aplicada pelo registro de `scripts/migracoes.mjs`, que a
    // pularia na segunda vez — mas o harness aplica a pasta inteira a cada
    // rodada, e um banco restaurado de backup pode não ter o registro. "Roda uma
    // vez só" é configuração, não propriedade do SQL; o que este caso cobra é a
    // propriedade.
    const jaColetado = {
      nascimento: { valor: "01/02/1990", em: "2026-09-21T10:00:00Z", automacao: null },
    };
    await semearContatoLegado(
      "duas_vezes",
      "fla@email.com",
      new Date("2026-02-02T02:00:00.000Z"),
      jaColetado
    );
    const id = await semearAutomacao("duas vezes", [
      { id: "b_duas01", tipo: "pedir_email", texto: "e-mail?" },
      { id: "b_duas02", tipo: "dm", texto: "obrigado" },
    ]);

    await rodarMigracao();
    const contatoDepoisDaPrimeira = await lerContato("duas_vezes");
    const autoDepoisDaPrimeira = await lerAutomacao(id);

    await rodarMigracao();
    const contatoDepoisDaSegunda = await lerContato("duas_vezes");
    const autoDepoisDaSegunda = await lerAutomacao(id);

    expect(contatoDepoisDaSegunda.campos).toEqual(contatoDepoisDaPrimeira.campos);
    expect(autoDepoisDaSegunda.steps).toEqual(autoDepoisDaPrimeira.steps);
    // E os dois campos continuam lá: o já coletado e o migrado.
    const registro = lerCampos(contatoDepoisDaSegunda.campos);
    expect([...registro.keys()].sort()).toEqual(["email", "nascimento"]);
    // NENHUMA LINHA FOI REESCRITA na segunda passada — nem a automação, nem o
    // contato. Sem estas duas asserções, um `where` que casasse de novo passaria
    // calado: o valor seria o mesmo, e só o custo (e a trava de tabela, que já
    // derrubou dois deploys desta base em 28/08/2026) mudaria.
    expect(autoDepoisDaSegunda.xmin, "a automação foi regravada na segunda passada").toBe(
      autoDepoisDaPrimeira.xmin
    );
    expect(contatoDepoisDaSegunda.xmin, "o contato foi regravado na segunda passada").toBe(
      contatoDepoisDaPrimeira.xmin
    );
  });
});
