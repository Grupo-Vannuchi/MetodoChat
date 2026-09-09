import { describe, it, expect } from "vitest";
import {
  motivoDoLoteVazio, textoDaRecusaDoLote, textoDoLoteEnviado,
  urlComAviso, urlDoAviso, avisoDaUrl, avisoDosPerfis, avisoDoLoteEnviado,
  urlDaConversaComAviso, avisoDaCategoriaSalva,
  urlDePublicarComAviso, avisoDaPublicacaoEnfileirada,
  urlDeAgendadosComAviso, avisoDoDesfecho,
  type ContagemDoLote,
} from "../lib/avisos";
import { textoDoDesfecho } from "../lib/publicacao";

describe("motivoDoLoteVazio", () => {
  // A ORDEM DOS MOTIVOS IMPORTA, e ESTE PAR é o único que a segura.
  //
  // O caso ao lado ("sem confirmacao vence sobre a conta vazia") passa
  // `filtroEntendido = true`, então o SEGUNDO ramo — `filtro_ilegivel` — nunca
  // chega a ser exercitado, e trocar as duas primeiras linhas de
  // `motivoDoLoteVazio` de lugar continuava verde. Medido em 02/09/2026: o
  // plantio que inverte a ordem passava nos quatro portões. É o mesmo modo de
  // falhar que o comentário daquele arquivo denuncia na versão anterior da
  // função: um nome que afirma a distinção e uma medição que não a mede.
  //
  // `(false, false, *)` é o ÚNICO par em que os dois primeiros ramos
  // respondem coisas diferentes — e por isso é o único que prende a ordem.
  it("sem confirmacao vence sobre o filtro ILEGIVEL — o unico par que prende a ordem", () => {
    expect(motivoDoLoteVazio(false, false, 10)).toBe("sem_confirmacao");
    expect(motivoDoLoteVazio(false, false, 0)).toBe("sem_confirmacao");
  });
  // E este é o outro lado do mesmo par: com a confirmação marcada, o segundo
  // ramo responde. Sem ele, o caso de cima passaria com o primeiro ramo
  // devolvendo qualquer coisa.
  it("sem confirmacao vence, mesmo com o filtro vazio", () => {
    expect(motivoDoLoteVazio(false, true, 0)).toBe("sem_confirmacao");
  });
  // OS TRES VAZIOS SAO TRES CONSELHOS DIFERENTES. A primeira versao devolvia
  // "ninguem_no_filtro" para os tres, e o nome deste caso ja denunciava a
  // contradicao: ele afirma a distincao e media a ausencia dela.
  it("filtro que nao foi entendido nao e confundido com filtro vazio", () => {
    expect(motivoDoLoteVazio(true, false, 10)).toBe("filtro_ilegivel");
  });
  it("conta sem contato nenhum nao manda procurar outra categoria", () => {
    expect(motivoDoLoteVazio(true, true, 0)).toBe("conta_sem_contatos");
  });
  it("confirmado e com gente na conta, mas ninguem no recorte", () => {
    expect(motivoDoLoteVazio(true, true, 10)).toBe("ninguem_no_filtro");
  });
  // AS TRES FRASES TEM DE SER DIFERENTES DE FATO: motivos distintos que
  // devolvessem o mesmo texto seriam a mesma confusao, um andar acima.
  it("as tres frases de vazio sao distintas entre si", () => {
    const frases = (["filtro_ilegivel", "conta_sem_contatos", "ninguem_no_filtro"] as const)
      .map(textoDaRecusaDoLote);
    expect(new Set(frases).size).toBe(3);
  });
});

describe("urlComAviso", () => {
  // AS DUAS ARMADILHAS NUM CASO SÓ: "tudo" não tem parâmetro nenhum e o aviso
  // entra com "?"; "uma" já tem "?categoria=" e o aviso PRECISA entrar com "&".
  // Concatenar "?" nos dois casos produziria "?categoria=x?aviso=y", que o
  // Next lê como categoria = "x?aviso=y" — e o filtro do redirect passaria a
  // ser uma categoria que não existe.
  it("filtro tudo: o aviso entra com interrogacao", () => {
    expect(urlComAviso("/contatos", { tipo: "tudo" }, "enviado"))
      .toBe("/contatos?aviso=enviado");
  });
  it("filtro com nome: o aviso entra com e-comercial", () => {
    expect(urlComAviso("/contatos", { tipo: "uma", nome: "aluno" }, "enviado"))
      .toBe("/contatos?categoria=aluno&aviso=enviado");
  });
  // O CASO QUE E O CRITICO DE HOJE VOLTANDO POR OUTRA PORTA: "sem categoria" e
  // `?categoria=` PRESENTE E VAZIO. Se o redirect o perder, a tela volta
  // mostrando a conta inteira depois de um envio.
  it("a ficha sem categoria sobrevive ao redirect", () => {
    expect(urlComAviso("/contatos", { tipo: "uma", nome: null }, "enviado"))
      .toBe("/contatos?categoria=&aviso=enviado");
  });
  it("categoria com espaco e e-comercial continua codificada", () => {
    expect(urlComAviso("/contatos", { tipo: "uma", nome: "turma & cia" }, "enviado"))
      .toBe("/contatos?categoria=turma%20%26%20cia&aviso=enviado");
  });
});

describe("textoDoLoteEnviado", () => {
  it("diz o repartimento, e nao so 'enviado'", () => {
    expect(textoDoLoteEnviado(3, 0)).toContain("3");
    expect(textoDoLoteEnviado(3, 0)).toContain("agora");
  });
  it("o singular nao sai errado", () => {
    expect(textoDoLoteEnviado(1, 1)).not.toContain("1 pessoas");
  });
  it("tudo guardado NAO diz que alguem recebeu agora", () => {
    const t = textoDoLoteEnviado(0, 5);
    expect(t).toContain("5");
    expect(t.toLowerCase()).not.toMatch(/0 receber/);
  });
});

// O DEFEITO ACHADO DEPOIS DO PLANO: `enviarLote` (app/contatos/actions.ts) tem
// `try { await drainQueue(); } catch {}` — e quando o dreno LANÇA (o motivo do
// catch existir), nenhum item do lote chega a virar 'sent' nem 'guardado'; os
// dois ficam 0 e os itens ficam 'pending'. `textoDoLoteEnviado(0, 0)` sozinha
// não sabe a diferença entre "ninguém confirmou" (impossível aqui — `alvoDoLote`
// já garantiu pelo menos um alvo antes desta contagem rodar) e "o dreno não deu
// tempo": as duas leem "0, 0". `avisoDoLoteEnviado` é quem resolve essa
// ambiguidade, com a terceira contagem — os itens 'pending' do PRÓPRIO lote —
// que já está a uma coluna de distância na consulta que soma `agora` e
// `guardadas`.
describe("avisoDoLoteEnviado", () => {
  // A CONTAGEM CHEGA COMO OBJETO, e os casos abaixo escrevem os cinco campos —
  // nunca um `...base` que esconda qual balde o caso mexeu. Cada linha diz onde
  // os itens deste lote pararam.
  const lote = (c: Partial<ContagemDoLote>): ContagemDoLote => {
    const agora = c.agora ?? 0;
    const guardadas = c.guardadas ?? 0;
    const pendentes = c.pendentes ?? 0;
    const paradas = c.paradas ?? 0;
    // O `total` PADRAO E A SOMA, para nenhum caso disparar o ramo do buraco sem
    // querer. Quem quer medir o buraco passa `total` na mao — e o caso proprio,
    // mais abaixo, faz exatamente isso.
    return { agora, guardadas, pendentes, paradas, total: c.total ?? agora + guardadas + pendentes + paradas };
  };

  // O CASO CENTRAL: zero confirmados, zero guardados, mas ALGUÉM pendente — só
  // acontece quando o dreno não terminou a tempo, porque `enviarLote` só chega
  // a esta contagem depois de `alvoDoLote` já ter recusado lote vazio. Antes
  // deste conserto, isto virava a MESMA frase e o MESMO tom "ok" de um envio
  // concluído — uma mentira tranquilizadora, pior que o silêncio que esta
  // branch fechou.
  it("ninguem confirmado e ninguem guardado, mas gente pendente, NAO e tom ok", () => {
    expect(avisoDoLoteEnviado(lote({ pendentes: 4 })).tom).not.toBe("ok");
  });
  it("a frase do pendente diz que as mensagens entraram na fila, e quantas", () => {
    const a = avisoDoLoteEnviado(lote({ pendentes: 4 }));
    expect(a.texto).toContain("4");
    // NÃO PODE REPETIR "0 guardadas": entrou na fila é diferente de guardado
    // (que é um estado deliberado, à espera da pessoa voltar a falar) e
    // diferente de recebido agora — a frase antiga confundia os três.
    expect(a.texto.toLowerCase()).not.toMatch(/0 guardad/);
    expect(a.texto.toLowerCase()).not.toMatch(/0 receb/);
  });
  // PENDENTE JUNTO DE GENTE JÁ CONFIRMADA NÃO É O CASO DESTE DEFEITO: é o lote
  // grande normal, em que o resto sai pelo próximo tique (comentário de
  // `enviarLote` sobre o teto de `BATCH_SIZE`). Continua "ok".
  it("pendente com gente ja confirmada nao dispara o alarme — e o lote grande normal", () => {
    const a = avisoDoLoteEnviado(lote({ agora: 3, pendentes: 5 }));
    expect(a.tom).toBe("ok");
    expect(a.texto).toBe(textoDoLoteEnviado(3, 0));
  });
  it("o singular do pendente nao sai errado", () => {
    expect(avisoDoLoteEnviado(lote({ pendentes: 1 })).texto).not.toContain("1 mensagens");
  });

  // ==========================================================================
  // A SEGUNDA PORTA DA MENTIRA TRANQUILIZADORA — o Critico de 02/09/2026.
  //
  // A consulta contava TRES status e o dreno grava CINCO. Um dia escolhido no
  // passado (o campo de data nao tinha `min`) fazia `loteExpirou` valer na
  // primeira drenagem e TODO item virar `skipped` antes de `processItem`: os
  // tres contadores zeravam, `pendentes > 0` nao disparava, e a faixa saia
  // VERDE. Cada caso abaixo e um status que nao era contado.
  // ==========================================================================
  it("o lote inteiro vencido antes de sair NAO e tom ok", () => {
    // (0, 0, 0) nos tres contadores antigos: era exatamente este o verde.
    expect(avisoDoLoteEnviado(lote({ paradas: 15 })).tom).toBe("erro");
  });
  it("a frase do lote parado diz QUANTAS nao sairam e onde ver o motivo", () => {
    const a = avisoDoLoteEnviado(lote({ paradas: 15 }));
    expect(a.texto).toContain("15");
    expect(a.texto).toMatch(/não vão sair/);
    expect(a.texto).toContain("Envios");
    // E NAO PODE DIZER "ninguem recebeu agora · 0 guardadas": e a frase do
    // envio concluido, e nada aqui foi concluido.
    expect(a.texto).not.toContain(textoDoLoteEnviado(0, 0));
  });
  it("o singular do lote parado nao sai errado", () => {
    const a = avisoDoLoteEnviado(lote({ paradas: 1 }));
    expect(a.texto).toContain("1 não saiu");
    expect(a.texto).not.toContain("não saíram");
  });
  // O QUE NAO SAIU VENCE O QUE SAIU. Metade entregue e metade morta por token
  // revogado nao e um envio concluido — mas a frase tem de dizer as DUAS
  // metades, senao ela apaga as pessoas que receberam de verdade.
  it("com gente entregue E gente parada, o tom e erro e a frase diz os dois numeros", () => {
    const a = avisoDoLoteEnviado(lote({ agora: 8, paradas: 7 }));
    expect(a.tom).toBe("erro");
    expect(a.texto).toContain("8 pessoas receberam agora");
    expect(a.texto).toContain("7");
  });

  // ==========================================================================
  // O BURACO: `total` e `count(*)` sem filtro, e e ele que impede a proxima
  // lista de status escrita a mao de envelhecer calada.
  // ==========================================================================
  it("nenhum item encontrado NAO e sucesso — a consulta nao achou o lote", () => {
    // `alvoDoLote` ja provou que havia gente, e `enqueueLote` acabou de gravar:
    // zero itens aqui e a chave do payload errada, nao um envio vazio. E o
    // desfecho do plantio que troca `lote_id` por `loteId`.
    const a = avisoDoLoteEnviado(lote({ total: 0 }));
    expect(a.tom).toBe("erro");
    expect(a.texto).toContain("Envios");
  });
  it("um status novo, que nenhum balde conta, e ACUSADO em vez de sumir no verde", () => {
    // Sete itens no lote, seis em baldes conhecidos: o setimo esta num estado
    // que este aviso nao sabe ler. Sem esta pergunta, ele viraria "6 receberam"
    // e o setimo desapareceria — que e o modo de falhar deste Critico, um
    // status adiante.
    const a = avisoDoLoteEnviado(lote({ agora: 6, total: 7 }));
    expect(a.tom).toBe("erro");
    expect(a.texto).toContain("1 de 7");
  });
  it("a soma fechando com os quatro baldes continua sendo o caminho normal", () => {
    const a = avisoDoLoteEnviado(lote({ agora: 6, guardadas: 3, pendentes: 2, total: 11 }));
    expect(a.tom).toBe("ok");
    expect(a.texto).toBe(textoDoLoteEnviado(6, 3));
  });
});

describe("avisoDaUrl", () => {
  it("aviso ausente e nulo", () => {
    expect(avisoDaUrl(undefined, undefined)).toBeNull();
  });
  // O TOM VEM DA URL, E A URL E DIGITAVEL: um tom desconhecido tem de cair em
  // "erro", e nunca virar classe de CSS montada com texto de fora.
  it("tom desconhecido cai em erro, e nao vira classe solta", () => {
    expect(avisoDaUrl("qualquer coisa", "roxo")?.tom).toBe("erro");
  });
});

// A URL do redirect precisa carregar DUAS coisas, e `urlComAviso` só carrega
// uma. `avisoDaUrl` lê `aviso` e `tom`, e um tom ausente cai em "erro" de
// propósito (tom desconhecido não pode virar classe de CSS montada com texto de
// fora) — então um aviso de SUCESSO enviado só com `urlComAviso` voltaria
// vermelho. É por isso que `urlDoAviso` existe, e é por isso que a ação não
// pode montar esse "&tom=" à mão.
describe("urlDoAviso", () => {
  it("o tom viaja junto com o texto", () => {
    expect(urlDoAviso("/contatos", { tipo: "tudo" }, { tom: "ok", texto: "3 receberam" })).toBe(
      "/contatos?aviso=3%20receberam&tom=ok"
    );
  });
  // O CRÍTICO DE 01/09 PELA TERCEIRA PORTA: `?categoria=` presente-e-vazio é a
  // ficha "sem categoria", e perdê-lo no redirect faz a tela voltar mostrando a
  // conta INTEIRA logo depois de um envio.
  it("nao perde o filtro presente-e-vazio", () => {
    expect(urlDoAviso("/contatos", { tipo: "uma", nome: null }, { tom: "erro", texto: "x" })).toBe(
      "/contatos?categoria=&aviso=x&tom=erro"
    );
  });
  it("o aviso volta inteiro de `avisoDaUrl`, e o filtro tambem", () => {
    const aviso = { tom: "ok", texto: "3 pessoas receberam agora · 0 guardadas" } as const;
    const u = new URL(urlDoAviso("/contatos", { tipo: "uma", nome: "aluno" }, aviso), "https://x");
    expect(
      avisoDaUrl(u.searchParams.get("aviso") ?? undefined, u.searchParams.get("tom") ?? undefined)
    ).toEqual(aviso);
    expect(u.searchParams.get("categoria")).toBe("aluno");
  });
  it("sem o tom, o sucesso voltaria vermelho — e e por isso que urlDoAviso existe", () => {
    const u = new URL(urlComAviso("/contatos", { tipo: "tudo" }, "deu certo"), "https://x");
    expect(
      avisoDaUrl(u.searchParams.get("aviso") ?? undefined, u.searchParams.get("tom") ?? undefined)
        ?.tom
    ).toBe("erro");
  });
});

describe("urlDaConversaComAviso", () => {
  it("monta o caminho da conversa com aviso e tom", () => {
    expect(urlDaConversaComAviso("123", { tom: "ok", texto: "Categoria salva" })).toBe(
      "/conversas/123?aviso=Categoria%20salva&tom=ok"
    );
  });
  // NÃO É `/contatos`, E NÃO TEM `?categoria=`: esta tela não tem filtro de
  // categoria — o "recorte" dela é um id de conversa só, sempre presente.
  it("nao carrega categoria nenhuma — nao e a mesma URL de /contatos", () => {
    const u = urlDaConversaComAviso("123", { tom: "erro", texto: "x" });
    expect(u.startsWith("/conversas/123?")).toBe(true);
    expect(u).not.toContain("categoria");
  });
  // O ID NÃO VALIDADO (caminho de recusa por formato) NÃO PODE QUEBRAR O
  // CAMINHO DA URL: uma barra a mais inseriria um segmento de rota estranho
  // em vez de simplesmente cair no notFound() que a página já faz.
  it("um id com caracteres de URL nao quebra o caminho", () => {
    const u = urlDaConversaComAviso("abc/def?g=h", { tom: "erro", texto: "Conversa inválida." });
    expect(u).toBe(
      "/conversas/abc%2Fdef%3Fg%3Dh?aviso=Conversa%20inv%C3%A1lida.&tom=erro"
    );
  });
  it("o aviso volta inteiro de avisoDaUrl", () => {
    const aviso = { tom: "ok", texto: "Categoria removida." } as const;
    const u = new URL(urlDaConversaComAviso("123", aviso), "https://x");
    expect(
      avisoDaUrl(u.searchParams.get("aviso") ?? undefined, u.searchParams.get("tom") ?? undefined)
    ).toEqual(aviso);
  });
});

describe("avisoDaCategoriaSalva", () => {
  it("categoria definida diz o nome dela", () => {
    const a = avisoDaCategoriaSalva("aluno");
    expect(a.tom).toBe("ok");
    expect(a.texto).toContain("aluno");
  });
  // TIRAR A CATEGORIA É PEDIDO LEGÍTIMO (campo em branco normaliza para
  // `null`, lib/categorias.ts), e a frase não pode confundir isso com "gravei
  // o nome vazio" — as duas são comemorações diferentes.
  it("categoria nula (campo em branco) diz REMOVIDA, e nao repete um nome vazio", () => {
    const a = avisoDaCategoriaSalva(null);
    expect(a.tom).toBe("ok");
    expect(a.texto.toLowerCase()).toContain("removid");
    expect(a.texto).not.toContain('""');
  });
});

describe("avisoDosPerfis", () => {
  it("perfil que veio e sucesso, e diz quantos", () => {
    const a = avisoDosPerfis(4, 10);
    expect(a.tom).toBe("ok");
    expect(a.texto).toContain("4");
  });
  // NENHUM PERFIL VEIO NÃO É SUCESSO. O botão roda 30 buscas na Meta e engole
  // cada falha; verde sobre zero seria a mesma mentira do silêncio, pintada.
  it("nenhum perfil veio NAO e sucesso", () => {
    expect(avisoDosPerfis(0, 10).tom).toBe("erro");
  });
  it("o singular nao sai errado", () => {
    expect(avisoDosPerfis(1, 1).texto).not.toContain("1 perfis");
  });
  // Nada a buscar é a ação terminando certo, e não uma falha: ninguém está sem
  // nome. (Acontece com dois cliques seguidos no botão.)
  it("nada para buscar nao e erro", () => {
    const a = avisoDosPerfis(0, 0);
    expect(a.tom).toBe("ok");
    expect(a.texto).not.toContain("0");
  });
});

describe("urlDePublicarComAviso", () => {
  // O TOM VAI JUNTO DO TEXTO, e e por isso que a funcao existe em vez de a
  // acao costurar a string. `avisoDaUrl` le DOIS parametros, e a omissao do
  // `tom` cai em "erro" de proposito — um sucesso mandado sem ele chegaria na
  // tela pintado de falha. Foi o defeito que o conserto de 02/09 fechou em
  // `/contatos`, e ele nao pode voltar por uma tela nova.
  it("o tom atravessa o redirect", () => {
    const url = urlDePublicarComAviso({ tom: "ok", texto: "Publicacao na fila." });
    expect(url).toContain("tom=ok");
    expect(avisoDaUrl(...comoAUrlChega(url))).toEqual({ tom: "ok", texto: "Publicacao na fila." });
  });

  // TEXTO E TEXTO DE GENTE: acento, "&", "?" e "#" nele quebrariam a URL, e o
  // que chegaria na tela seria meio aviso.
  it("o texto e codificado", () => {
    const texto = "Nao deu: a legenda & a hashtag #promo? nao cabem";
    const url = urlDePublicarComAviso({ tom: "erro", texto });
    expect(url).not.toContain("#promo");
    expect(avisoDaUrl(...comoAUrlChega(url))?.texto).toBe(texto);
  });
});

/** O que o Next entrega em `searchParams` a partir de uma URL montada — o
 *  caminho de volta do redirect, decodificado, para o teste conferir o par
 *  inteiro em vez de so a string. */
function comoAUrlChega(url: string): [string | undefined, string | undefined] {
  const q = new URLSearchParams(url.slice(url.indexOf("?") + 1));
  return [q.get("aviso") ?? undefined, q.get("tom") ?? undefined];
}

describe("avisoDaPublicacaoEnfileirada", () => {
  // "NA FILA" E O QUE DE FATO ACONTECEU. Enfileirar nao e publicar: a Meta leva
  // de 10 a 32 segundos (medido em 03/09), o item sai pela fila e a tela nao
  // espera. Um "publicado!" aqui seria a comemoracao antes do desfecho.
  it("agora diz que esta na fila, e nao que publicou", () => {
    const a = avisoDaPublicacaoEnfileirada(null);
    expect(a.tom).toBe("ok");
    expect(a.texto).toContain("fila");
    expect(a.texto).not.toContain("publicad");
  });

  // AS DUAS FRASES SAO DIFERENTES, e confundi-las e caro nos dois sentidos:
  // quem agendou e le "sai agora" corre para desfazer o que nao aconteceu, e
  // quem publicou agora e le "agendado" espera um post que ja esta no ar — e o
  // post no ar so sai a mao pelo celular, porque DELETE nao existe no nosso
  // caminho.
  it("agendado diz a hora escolhida, com zero a esquerda", () => {
    const a = avisoDaPublicacaoEnfileirada({ dia: 3, mes: 9, hora: 8, minuto: 5 });
    expect(a.tom).toBe("ok");
    expect(a.texto).toContain("03/09");
    expect(a.texto).toContain("08:05");
  });

  it("as duas frases nao sao a mesma", () => {
    expect(avisoDaPublicacaoEnfileirada(null).texto).not.toBe(
      avisoDaPublicacaoEnfileirada({ dia: 10, mes: 9, hora: 14, minuto: 30 }).texto
    );
  });
});

describe("urlDeAgendadosComAviso", () => {
  // A VOLTA E PARA A LISTA, E NAO PARA `/publicar`. Quem clicou em cancelar
  // estava olhando os agendados, e cair na tela de compor depois de cancelar
  // faria a lista — a unica prova de que o post sumiu — nao ser vista.
  it("volta para a lista de agendados", () => {
    const url = urlDeAgendadosComAviso({ tom: "ok", texto: "Post cancelado." });
    expect(url.startsWith("/publicar/agendados?")).toBe(true);
  });

  it("o tom atravessa o redirect", () => {
    const url = urlDeAgendadosComAviso({ tom: "ok", texto: "Post cancelado." });
    expect(avisoDaUrl(...comoAUrlChega(url))).toEqual({ tom: "ok", texto: "Post cancelado." });
  });

  it("o texto e codificado", () => {
    const texto = "Ja saiu: o post & a legenda #promo? nao voltam";
    const url = urlDeAgendadosComAviso({ tom: "erro", texto });
    expect(url).not.toContain("#promo");
    expect(avisoDaUrl(...comoAUrlChega(url))?.texto).toBe(texto);
  });
});

describe("avisoDoDesfecho", () => {
  // O TOM E A METADE DO AVISO QUE MENTE MAIS RAPIDO: a faixa e verde ou
  // vermelha antes de alguem ler a frase. Um "tarde demais" pintado de verde
  // seria a mentira central desta entrega contada so pela cor.
  it("so o feito e verde", () => {
    expect(avisoDoDesfecho("feito", "cancelar").tom).toBe("ok");
    expect(avisoDoDesfecho("feito", "remarcar").tom).toBe("ok");
    for (const d of ["tarde_demais", "nao_encontrado", "data_invalida", "data_no_passado"] as const) {
      for (const acao of ["cancelar", "remarcar"] as const) {
        expect(avisoDoDesfecho(d, acao).tom).toBe("erro");
      }
    }
  });

  // A FRASE E A DE `textoDoDesfecho`, e nao uma segunda redacao: e a mesma
  // disciplina que faz a acao de publicar nunca escrever string.
  it("o texto vem da funcao pura, sem redacao nova", () => {
    expect(avisoDoDesfecho("tarde_demais", "cancelar").texto).toBe(
      textoDoDesfecho("tarde_demais", "cancelar")
    );
  });

  it("tarde demais chega na tela dizendo que o post saiu", () => {
    const a = avisoDoDesfecho("tarde_demais", "cancelar");
    expect(a.tom).toBe("erro");
    expect(a.texto.toLowerCase()).toMatch(/saiu|saindo|publicad/);
  });
});
