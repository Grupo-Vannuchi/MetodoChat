// A CHAVE DO APP DA META FORA DA PÁGINA DE CONFIGURAÇÃO (achado 123;
// docs/specs/2026-10-26-chave-fora-da-pagina.md).
//
// A etapa 2 da Configuração desenhava o campo da chave secreta com o valor dela no `defaultValue`. O campo
// é de senha, então a tela mostrava ●●●●, mas o valor ia inteiro no HTML, e qualquer pessoa logada no
// painel o lia pelo código-fonte. Aqui a página é desenhada de verdade, num contexto de requisição, e a
// árvore que ela devolve é lida por `textoDaArvore`, que inclui os `props` simples, como o `defaultValue`.
//
// O SALVAR TEM DE ACOMPANHAR: sem o valor no campo, salvar o formulário com a chave em branco não pode
// apagar a chave gravada, nem ser recusado quando ela já existe.
import { beforeAll, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao, comoNumaRequisicaoComSessao } from "./semear-requisicao";
import { textoDaArvore } from "./texto-da-arvore";

const banco = bancoDescartavel();

// Valores inventados. Nenhuma credencial de verdade entra em teste.
const APP_ID = "1234567890123456";
const CHAVE = "chave-de-teste-que-nao-vale-nada-7f3a";
const CHAVE_NOVA = "chave-nova-de-teste-que-nao-vale-nada-9c1d";

type ModuloPagina = typeof import("@/app/setup/page");
type ModuloAcoes = typeof import("@/app/setup/actions");
let pagina: ModuloPagina;
let acoes: ModuloAcoes;

beforeAll(async () => {
  pagina = await import("@/app/setup/page");
  acoes = await import("@/app/setup/actions");
  await banco.db().sql().query(`insert into config (id) values (1) on conflict do nothing`);
});

async function gravarChave(chave: string | null): Promise<void> {
  await banco.db().sql().query(`update config set instagram_app_id = $1, instagram_app_secret = $2 where id = 1`, [
    APP_ID,
    chave,
  ]);
}

async function chaveGravada(): Promise<string | null> {
  const [linha] = (await banco.db().sql().query(`select instagram_app_secret from config where id = 1`)) as {
    instagram_app_secret: string | null;
  }[];
  return linha.instagram_app_secret;
}

/** O destino do redirect do salvar, lido do `digest`, como em bonus-acoes.integracao.ts. */
async function salvar(campos: Record<string, string>): Promise<string | null> {
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.set(k, v);
  const { valor } = await comoNumaRequisicaoComSessao("/setup", async () => {
    try {
      await acoes.saveMetaCredentials(form);
      return null as string | null;
    } catch (e) {
      const digest = (e as { digest?: unknown }).digest;
      if (typeof digest === "string") return digest;
      throw e;
    }
  });
  if (valor === null || !valor.startsWith("NEXT_REDIRECT;")) return null;
  return decodeURIComponent(valor.split(";").slice(2, -2).join(";"));
}

describe("a chave do app da Meta na Configuração", () => {
  it("a página não leva a chave, e diz que ela está configurada", async () => {
    await gravarChave(CHAVE);
    const { valor } = await comoNumaRequisicao("/setup", () =>
      pagina.default({ searchParams: Promise.resolve({}) })
    );
    const texto = textoDaArvore(valor);
    // A guarda do instrumento: o App ID, que vai na mesma etapa, TEM de aparecer. Sem isto, um
    // `not.toContain` verde poderia ser só uma leitura que não alcança o formulário.
    expect(texto).toContain(APP_ID);
    expect(texto).not.toContain(CHAVE);
    expect(texto).toContain("Chave configurada");
  });

  it("salvar com o campo da chave em branco mantém a chave gravada", async () => {
    await gravarChave(CHAVE);
    const destino = await salvar({ instagram_app_id: APP_ID, instagram_app_secret: "" });
    expect(destino).toBe("/setup?salvo=1");
    expect(await chaveGravada()).toBe(CHAVE);
  });

  it("sem chave gravada, o campo em branco é recusado e nada é gravado", async () => {
    await gravarChave(null);
    const destino = await salvar({ instagram_app_id: APP_ID, instagram_app_secret: "" });
    expect(destino).toBe("/setup?erro=Preencha o App ID e a chave secreta.");
    expect(await chaveGravada()).toBe(null);
  });

  it("uma chave nova no campo substitui a gravada", async () => {
    await gravarChave(CHAVE);
    const destino = await salvar({ instagram_app_id: APP_ID, instagram_app_secret: CHAVE_NOVA });
    expect(destino).toBe("/setup?salvo=1");
    expect(await chaveGravada()).toBe(CHAVE_NOVA);
  });
});
