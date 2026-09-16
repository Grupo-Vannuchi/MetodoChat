// A CONFERÊNCIA QUE SÓ O NAVEGADOR FAZ — repetível, e não mais de memória.
//
// POR QUE ESTE ARQUIVO EXISTE, e a conta é honesta: em 16/09/2026 dois defeitos
// chegaram à produção e NENHUM DOS DOIS seria pego por teste de unidade, de
// integração ou por suíte de jsdom.
//
//   1. A FOTO VENCIDA que nunca virava inicial. O `<img>` vem pronto do
//      servidor, a URL assinada da Meta já venceu, e o evento `error` dispara
//      ANTES de o React hidratar e pendurar o `onError`. O React não redispara
//      `error` para imagem que já falhou. Isso é TEMPO DE HIDRATAÇÃO: jsdom nem
//      carrega imagem, então lá os estados teriam de ser forjados e o teste
//      mediria o predicado, não o navegador.
//   2. A SELEÇÃO QUE ENCOLHIA ao trocar de filtro. Três pessoas marcadas viravam
//      uma, porque `<input>` não-controlado é reconciliado por POSIÇÃO. O
//      conserto é uma `key` dentro de um Server Component, que jsdom não
//      renderiza.
//
// Os dois foram achados dirigindo um navegador de verdade contra a produção. O
// buraco, então, não era "falta jsdom": era essa conferência existir só enquanto
// alguém está olhando. As asserções abaixo são exatamente as que teriam ficado
// VERMELHAS naquele dia.
//
// -----------------------------------------------------------------------------
// COMO RODAR
//
//   1. Abra um navegador com PERFIL DEDICADO e depuração remota:
//
//        chrome --remote-debugging-port=9222 ^
//               --user-data-dir="%LOCALAPPDATA%\metodochat-conferencia"
//
//      O PERFIL SEPARADO NÃO É CAPRICHO — é obrigatório. Desde o Chrome 136,
//      `--remote-debugging-port` é IGNORADO em silêncio quando o perfil é o
//      padrão: é uma proteção contra roubo de cookie, e o sintoma é a porta nem
//      abrir (medido em 16/09/2026: o processo sobe, nada escuta na porta). O
//      caminho manual de `chrome://inspect/#remote-debugging` também não serve
//      aqui, porque ele não publica os endpoints HTTP de descoberta que este
//      script usa — medido no mesmo dia: 404 em `/json/version`.
//
//   2. ENTRE NO PAINEL nessa janela, UMA VEZ. O perfil guarda a sessão, então
//      as próximas rodadas não pedem nada. Este script não faz login e não
//      conhece senha nenhuma.
//
//   3. npm run conferir:navegador
//      npm run conferir:navegador -- --base=https://<previa>.vercel.app
//      npm run conferir:navegador -- --porta=9333
//
// SEM DEPENDÊNCIA NOVA: o Node 22+ traz `WebSocket` global, e o protocolo do
// DevTools é HTTP para achar a aba mais WebSocket para conversar. Este arquivo
// não adiciona uma linha ao `package.json` além do atalho.
//
// -----------------------------------------------------------------------------
// O QUE ELE NUNCA FAZ, e isto é regra e não estilo:
//
//   - NÃO SUBMETE FORMULÁRIO. Ele marca e desmarca caixas de seleção, que é
//     estado de tela, e nunca toca nos botões `clientes`/`equipe`/`amigos`/
//     `alunos`, que gravam categoria em contato de verdade. A guarda
//     `recusarSeSubmeter` abaixo estoura se algum passo tentar.
//   - NÃO FAZ LOGIN e não conhece senha nenhuma.
//   - NÃO MEXE EM AUTOMAÇÃO, não envia mensagem, não escreve no banco.
//
// E ELE FILTRA POR VISIBILIDADE EM TODA CONTAGEM. Numa aba reusada, o App Router
// mantém no DOM as renderizações anteriores, e `document.images` conta esses
// restos — todos com largura zero. Em 16/09 isso me fez ler "13 quebradas" antes
// e depois de um deploy e quase concluir que o conserto falhara. Toda contagem
// aqui passa por `visivel()`, e cada rota é aberta com navegação de verdade.

const BASE_PADRAO = "https://metodochat.vercel.app";
const PORTA_PADRAO = 9222;

const arg = (nome, padrao) => {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.slice(nome.length + 3) : padrao;
};
const BASE = arg("base", BASE_PADRAO).replace(/\/$/, "");
const PORTA = Number(arg("porta", PORTA_PADRAO));

// --- a conversa com o navegador, em CDP cru -------------------------------

class Aba {
  #ws;
  #id = 0;
  #pendentes = new Map();

  static async conectar(porta) {
    let abas;
    try {
      abas = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
    } catch {
      throw new Error(
        `NÃO ACHEI NAVEGADOR na porta ${porta}.\n\n` +
          `  chrome --remote-debugging-port=${porta} \\\n` +
          `         --user-data-dir="%LOCALAPPDATA%\\metodochat-conferencia"\n\n` +
          `O --user-data-dir É OBRIGATÓRIO: desde o Chrome 136 a porta de ` +
          `depuração é IGNORADA em silêncio no perfil padrão (proteção contra ` +
          `roubo de cookie), e o sintoma é exatamente este — o navegador abre e ` +
          `nada escuta na porta. Depois de abrir, ENTRE NO PAINEL uma vez: o ` +
          `perfil guarda a sessão. Este script não faz login e não conhece senha.`
      );
    }
    // PREFERE a aba que já está no painel, e aceita qualquer outra: um
    // navegador recém-aberto fica em `about:blank`, que é estado normal e não
    // motivo para recusar. Quem confere se estamos logados é a guarda lá
    // embaixo, depois de navegar — e ela dá a mensagem certa.
    const paginas = abas.filter((a) => a.type === "page");
    const pagina = paginas.find((a) => a.url.startsWith(BASE)) ?? paginas[0];
    if (!pagina) {
      throw new Error(
        `O navegador da porta ${porta} não tem nenhuma aba aberta. Abra uma aba ` +
          `(pode ser em branco), entre no painel, e rode de novo.`
      );
    }
    const aba = new Aba();
    await aba.#abrir(pagina.webSocketDebuggerUrl);
    return aba;
  }

  #abrir(url) {
    return new Promise((ok, falhou) => {
      this.#ws = new WebSocket(url);
      this.#ws.onopen = () => ok();
      this.#ws.onerror = () => falhou(new Error(`Não consegui falar com ${url}`));
      this.#ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        const p = this.#pendentes.get(msg.id);
        if (!p) return;
        this.#pendentes.delete(msg.id);
        if (msg.error) p.falhou(new Error(msg.error.message));
        else p.ok(msg.result);
      };
    });
  }

  chamar(method, params = {}) {
    const id = ++this.#id;
    return new Promise((ok, falhou) => {
      this.#pendentes.set(id, { ok, falhou });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Avalia a expressão na página e devolve o valor já desembrulhado. */
  async js(expressao) {
    const r = await this.chamar("Runtime.evaluate", {
      expression: expressao,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(`Erro na página: ${r.exceptionDetails.text}`);
    }
    return r.result.value;
  }

  fechar() {
    this.#ws.close();
  }
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Espera a condição virar verdadeira, ou estoura dizendo o que esperava. */
async function esperarAte(aba, condicao, oQueEsperava, tetoMs = 15000) {
  const limite = Date.now() + tetoMs;
  while (Date.now() < limite) {
    if (await aba.js(`(() => { try { return !!(${condicao}); } catch { return false; } })()`)) {
      // O React ainda pode estar comitando: um respiro curto evita ler a tela
      // no meio da troca. Não é "esperar dar certo" — a condição já é verdade.
      await dormir(400);
      return;
    }
    await dormir(200);
  }
  throw new Error(`ESPEREI E NÃO VEIO: ${oQueEsperava}`);
}

/** Abre uma rota com navegação de VERDADE, e não com clique no painel. */
async function irPara(aba, rota) {
  await aba.js(`location.assign(${JSON.stringify(BASE + rota)})`);
  await esperarAte(
    aba,
    `document.readyState === "complete" && location.pathname === ${JSON.stringify(rota.split("?")[0])}`,
    `a rota ${rota} carregar`
  );
  await dormir(600);
}

// --- o vocabulário da página, num lugar só --------------------------------
//
// Tudo o que este script pergunta à tela passa por aqui, e toda contagem filtra
// por VISIBILIDADE — ver o cabeçalho.

const VISIVEL = `(e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }`;

const IMAGENS = `(() => {
  const vis = ${VISIVEL};
  const im = [...document.images].filter(vis);
  return { total: im.length, quebradas: im.filter((i) => i.complete && i.naturalWidth === 0).length };
})()`;

const SELECAO = `(() => {
  const vis = ${VISIVEL};
  const cs = [...document.querySelectorAll('input[name="ig_id"]')].filter(vis);
  const cab = [...document.querySelectorAll('input[type=checkbox]')].filter((c) => !c.name && vis(c));
  const m = document.body.innerText.match(/(\\d+)\\s+selecionad/);
  return {
    linhas: cs.length,
    marcados: cs.filter((c) => c.checked).map((c) => c.value),
    indeterminado: cab.some((c) => c.indeterminate),
    contador: m ? Number(m[1]) : 0,
  };
})()`;

/** ESTOURA se a página tiver um botão que grava categoria prestes a ser tocado.
 *  Nenhum passo deste script clica neles — esta guarda existe para o caso de
 *  alguém acrescentar um passo distraído. */
async function recusarSeSubmeter(aba, oQueIaFazer) {
  const perigo = await aba.js(`(() => {
    const b = [...document.querySelectorAll('button[type=submit][name="categoria"]')];
    return b.length;
  })()`);
  if (perigo > 0 && oQueIaFazer === "submeter") {
    throw new Error(
      "RECUSADO: este script NUNCA submete o formulário de categoria. Ele marca " +
        "e desmarca caixas, que é estado de tela; gravar categoria em contato de " +
        "verdade é do marketing, não de uma conferência."
    );
  }
}

// --- as conferências ------------------------------------------------------

const resultados = [];
function registrar(nome, ok, detalhe) {
  resultados.push({ nome, ok, detalhe });
  console.log(`${ok ? "  OK  " : " FALHA"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
}

/** As telas que mostram foto de URL assinada da Meta, que VENCE. */
const TELAS_COM_FOTO = ["/conversas", "/contatos", "/eventos", "/automacoes"];

async function conferirImagens(aba) {
  for (const rota of TELAS_COM_FOTO) {
    await irPara(aba, rota);
    const { total, quebradas } = await aba.js(IMAGENS);
    registrar(
      `${rota}: nenhuma imagem quebrada na tela`,
      quebradas === 0,
      `${total} visíveis, ${quebradas} quebradas` +
        (quebradas > 0
          ? ". A URL assinada do CDN vence em ~2 semanas; quando ela vence, o " +
            "recuo para a inicial (app/usar-imagem-quebrada.ts) é que tem de " +
            "aparecer. Imagem quebrada aqui significa que o recuo não rodou."
          : "")
    );
  }
}

async function conferirSelecao(aba) {
  await irPara(aba, "/contatos");
  await recusarSeSubmeter(aba, "marcar");

  const inicial = await aba.js(SELECAO);
  if (inicial.linhas < 8) {
    registrar(
      "/contatos: há linhas suficientes para conferir a seleção",
      false,
      `só ${inicial.linhas} linhas visíveis; esta conferência precisa de pelo menos 8`
    );
    return;
  }

  // Marca três FORA DO TOPO, de propósito: com as três primeiras, preservar por
  // posição e preservar por identidade dão o mesmo resultado, e o caso não
  // distingue os dois. Foi assim que a primeira medição de 16/09 ficou
  // inconclusiva.
  await aba.js(`(() => {
    const cs = document.querySelectorAll('input[name="ig_id"]');
    [4, 5, 6].forEach((i) => cs[i].click());
    return 1;
  })()`);
  await esperarAte(aba, `(${SELECAO}).contador === 3`, "o contador chegar a 3");

  const marcadas = await aba.js(SELECAO);
  registrar("o contador acompanha a seleção", marcadas.contador === 3, `contador = ${marcadas.contador}`);
  registrar(
    "seleção parcial acende o traço de indeterminado",
    marcadas.indeterminado === true,
    marcadas.indeterminado ? "" : "o cabeçalho devia estar indeterminado com 3 de " + marcadas.linhas
  );

  // "VER MAIS" TEM DE PRESERVAR: ele só ACRESCENTA linhas, as posições de cima
  // não se mexem. Este caso é o que fica vermelho se a `key` do formulário
  // (app/contatos/page.tsx) passar a depender de `linhas`.
  const temVerMais = await aba.js(
    `(() => !![...document.querySelectorAll('a')].find((a) => /ver mais/i.test(a.textContent)))()`
  );
  if (temVerMais) {
    await aba.js(
      `(() => { [...document.querySelectorAll('a')].find((a) => /ver mais/i.test(a.textContent)).click(); return 1; })()`
    );
    await esperarAte(aba, `(${SELECAO}).linhas > ${marcadas.linhas}`, "a lista crescer depois do 'Ver mais'");
    const depois = await aba.js(SELECAO);
    const mesmas = marcadas.marcados.every((v) => depois.marcados.includes(v));
    registrar(
      `'Ver mais' PRESERVA a seleção`,
      mesmas && depois.marcados.length === 3,
      `${marcadas.linhas} -> ${depois.linhas} linhas, ${depois.marcados.length} de 3 marcadas` +
        (mesmas ? "" : ". Se a `key` do <form> passou a depender de `linhas`, cada 'Ver mais' apaga a seleção.")
    );
  } else {
    registrar("'Ver mais' PRESERVA a seleção", true, "não há 'Ver mais' nesta conta agora — pulado");
  }

  // TROCAR FILTRO TEM DE LIMPAR: a lista é SUBSTITUÍDA, e sobreviver marcado só
  // o que calha de cair no mesmo índice é o defeito de 16/09 — três viravam uma,
  // e quem aplicasse a categoria aplicaria a uma achando que aplicou a três.
  const temFiltro = await aba.js(
    `(() => !![...document.querySelectorAll('a')].find((a) => /sem categoria/i.test(a.textContent)))()`
  );
  if (!temFiltro) {
    registrar("trocar de filtro LIMPA a seleção", true, "não há ficha de filtro nesta conta agora — pulado");
    return;
  }
  await aba.js(
    `(() => { [...document.querySelectorAll('a')].find((a) => /sem categoria/i.test(a.textContent)).click(); return 1; })()`
  );
  await esperarAte(aba, `location.search.includes("categoria=")`, "a URL do filtro mudar");
  const depoisDoFiltro = await aba.js(SELECAO);
  registrar(
    "trocar de filtro LIMPA a seleção",
    depoisDoFiltro.marcados.length === 0 && depoisDoFiltro.contador === 0,
    `${depoisDoFiltro.marcados.length} marcadas, contador ${depoisDoFiltro.contador}` +
      (depoisDoFiltro.marcados.length > 0
        ? ". A `key` do <form> (app/contatos/page.tsx) precisa mudar com o filtro, " +
          "senão o React reconcilia as caixas por POSIÇÃO e a seleção encolhe calada."
        : "")
  );
}

// --- o fio principal ------------------------------------------------------

const aba = await Aba.conectar(PORTA);
console.log(`\nConferindo ${BASE} pela porta ${PORTA}.\n`);
try {
  await aba.js(`location.assign(${JSON.stringify(BASE + "/contatos")})`);
  await esperarAte(aba, `document.readyState === "complete"`, "a primeira página carregar");
  const entrar = await aba.js(`location.pathname.includes("entrar")`);
  if (entrar) {
    throw new Error(
      "O NAVEGADOR NÃO ESTÁ LOGADO no painel: caí em /entrar. Entre na mão nesta " +
        "mesma janela e rode de novo — este script não faz login e não conhece senha."
    );
  }
  await conferirImagens(aba);
  await conferirSelecao(aba);
} finally {
  aba.fechar();
}

const falharam = resultados.filter((r) => !r.ok);
console.log(
  `\n${resultados.length - falharam.length} de ${resultados.length} conferências passaram.`
);
if (falharam.length) {
  console.log("\nO QUE FALHOU:");
  for (const f of falharam) console.log(`  - ${f.nome}: ${f.detalhe}`);
  process.exit(1);
}
