// AS FRASES DO GERADOR DE BÔNUS, fora do JSX.
//
// Mesmo princípio de lib/avisos.ts: uma saída muda é indistinguível de sucesso, e
// o texto de cada saída vem de função pura, com teste. As telas só leem daqui.
import type { Aviso } from "@/lib/avisos";
import type { CampoRevisado } from "./contrato";
import type { Detalhe, MotivoDoEnvio } from "./desfecho";
import type { FaltaNoEnvio, ResultadoDoEnvio } from "./envio";
import {
  O_QUE_RESOLVE_MAX,
  O_QUE_RESOLVE_MIN,
  PALAVRA_MAX,
  PALAVRA_MIN,
  TEMA_MAX,
  TETO_DIARIO,
  type RecusaDoPedido,
} from "./pedido";
import { TIMEOUT_ENVIO_MS } from "./tempos";

/** O aviso vai pela URL com texto E tom: `avisoDaUrl` lê os dois, e sem tom tudo vira erro. */
export function urlDoBonusComAviso(id: string | null, aviso: Aviso): string {
  const base = id === null ? "/bonus" : `/bonus/${id}`;
  return `${base}?aviso=${encodeURIComponent(aviso.texto)}&tom=${aviso.tom}`;
}

export function textoDaRecusaDoPedido(motivo: RecusaDoPedido): string {
  switch (motivo) {
    case "tema_vazio":
      return "Escolha um tema. Ele precisa existir no catálogo do Labs.";
    case "tema_longo":
      return `O tema passa de ${TEMA_MAX} caracteres.`;
    case "o_que_resolve_curto":
      return `Conte em pelo menos ${O_QUE_RESOLVE_MIN} caracteres o que o bônus resolve. É daí que a IA parte.`;
    case "o_que_resolve_longo":
      return `O que o bônus resolve passa de ${O_QUE_RESOLVE_MAX} caracteres. Resuma.`;
    case "palavra_invalida":
      return `A palavra-chave tem de ser uma palavra só, de ${PALAVRA_MIN} a ${PALAVRA_MAX} letras ou números, sem espaço.`;
  }
}

export function textoDoTeto(): string {
  return `Você já gerou ${TETO_DIARIO} bônus nas últimas 24 horas, que é o limite. Ele volta a abrir quando a geração mais antiga completar um dia.`;
}

export type FaltaDeConfig = "sem_chave_ia" | FaltaNoEnvio;

export function textoDaConfig(falta: FaltaDeConfig): string {
  switch (falta) {
    case "sem_chave_ia":
      return "A geração está desligada: falta a ANTHROPIC_API_KEY no servidor.";
    case "sem_segredo":
      return "O envio ao Labs está desligado: falta o BONUS_INTAKE_SECRET no servidor. O bônus continua salvo aqui.";
    case "sem_url":
      return "O envio ao Labs está desligado: falta a LABS_URL no servidor. O bônus continua salvo aqui.";
    case "url_invalida":
      return "A LABS_URL do servidor não é um endereço https válido, então o envio ao Labs está desligado.";
  }
}

export const TEXTO_BONUS_NAO_ENCONTRADO = "Esse bônus não existe, ou o endereço está errado.";
export const TEXTO_NAO_DA_PARA_GERAR_DE_NOVO =
  "Só dá para gerar de novo um bônus cuja geração falhou ou travou.";
export const TEXTO_CONFERENCIA_VENCIDA =
  "Esse bônus não está mais esperando conferência. O estado atual está abaixo.";
export const TEXTO_TABELA_AUSENTE =
  "Falta a tabela do gerador de bônus neste banco. Aplique a migração 013 (migrations/013-bonus-gerados.sql) e recarregue.";
export const TEXTO_TRAVOU =
  "A geração parou no meio e não vai terminar. O servidor provavelmente reiniciou durante a chamada. Pode gerar de novo.";
export const TEXTO_SEM_VALORES =
  "A resposta da IA não passou na conferência de formato. Gere de novo.";

export const ROTULO_DO_CAMPO: Record<CampoRevisado, string> = {
  titulo: "Título",
  slug: "Endereço (slug)",
  palavra: "Palavra-chave",
  descricao: "Descrição",
  intro: "Como usar",
  prompt: "Prompt",
  tema: "Tema",
};

export function textoDosProblemas(problemas: { campo: string; erro: string }[]): string {
  const rotulo = (campo: string) =>
    campo in ROTULO_DO_CAMPO ? ROTULO_DO_CAMPO[campo as CampoRevisado] : campo;
  return `${problemas.map((p) => `${rotulo(p.campo)}: ${p.erro}`).join(". ")}.`;
}

export function textoDoEnvioRecusado(r: Exclude<ResultadoDoEnvio, { tipo: "enviado" }>): string {
  switch (r.tipo) {
    case "sem_config":
      return textoDaConfig(r.motivo);
    case "nao_encontrado":
      return "Esse bônus não está pronto para envio.";
    case "invalido":
      return `Corrija antes de enviar. ${textoDosProblemas(r.problemas)}`;
    case "ocupado":
      return "Já há um envio deste bônus em andamento, ou ele não pode mais ser enviado. Espere alguns segundos e recarregue a página.";
    case "superado":
      return "Outro envio deste bônus começou enquanto este esperava o Labs, e o resultado que vale é o dele. O estado atual está abaixo.";
  }
}

export type TomDoQuadro = "ok" | "atencao" | "erro";
export type Quadro = { tom: TomDoQuadro; titulo: string; texto: string };

const PASSO_SEGUINTE =
  "O link só funciona depois que alguém publicar o bônus no /admin do Labs. Publique antes de pôr o link numa automação: até lá, quem comentar cai numa página de erro.";

const REENVIO_SEGURO = "Enviar de novo é seguro: vai o mesmo conteúdo, com o mesmo endereço.";

function incerto(causa: string): Quadro {
  return { tom: "atencao", titulo: "Não sabemos se o bônus chegou", texto: `${causa} ${REENVIO_SEGURO}` };
}

export const QUADRO_ENVIANDO: Quadro = {
  tom: "atencao",
  titulo: "Enviando ao Labs",
  texto: "Recarregue a página em alguns segundos.",
};

export const QUADRO_DO_ENVIO_PARADO: Quadro = incerto("O último envio não terminou.");

export function quadroDoEnvio(motivo: MotivoDoEnvio, d: Detalhe, slug: string | null): Quadro {
  const endereco = slug ?? "deste bônus";
  switch (motivo) {
    case "criado":
      return { tom: "ok", titulo: "Criado no Labs, ainda oculto", texto: PASSO_SEGUINTE };
    case "criado_pelo_titulo":
      return {
        tom: "ok",
        titulo: "Criado no Labs, ainda oculto",
        texto: `Uma tentativa anterior chegou ao Labs sem que a resposta voltasse, e o bônus existe uma vez só. ${PASSO_SEGUINTE}`,
      };
    case "criado_pela_duplicata":
      return {
        tom: "ok",
        titulo: "Criado no Labs, ainda oculto",
        texto: `Uma tentativa anterior chegou ao Labs sem que a resposta voltasse: o Labs achou este bônus, com o mesmo endereço e o mesmo título, e ele existe uma vez só. ${PASSO_SEGUINTE}`,
      };
    case "conferido_existe":
      return { tom: "ok", titulo: "Marcado como criado pela sua conferência", texto: PASSO_SEGUINTE };
    case "conferido_nao_existe":
      return {
        tom: "atencao",
        titulo: "Você conferiu que o bônus não está no Labs",
        texto: "Os campos voltaram a ser editáveis. Ajuste o que precisar e envie de novo.",
      };
    // O `duplicate` sem tentativa anterior: o mesmo endereço E o mesmo título já estão lá,
    // e não saíram deste envio. Trocar só o slug publicaria um quase igual (lembrado
    // pela sessão do Labs), então a frase manda conferir antes.
    case "colisao":
      return {
        tom: "erro",
        titulo: "Já existe no Labs um bônus igual a este",
        texto: `O Labs já tem um bônus com o endereço ${endereco} e este mesmo título, e ele não saiu deste envio. Confira no /admin do Labs antes de continuar: se for o mesmo conteúdo, não precisa enviar. Para publicar um bônus diferente, mude o título e o slug. Nada deste bônus foi criado.`,
      };
    case "slug_ocupado":
      return {
        tom: "erro",
        titulo: "Esse endereço já é de outro bônus no Labs",
        texto: `O slug ${endereco} já pertence a um bônus com outro título. Troque o slug e envie de novo. Nada deste bônus foi criado.`,
      };
    case "conferir":
      return {
        tom: "atencao",
        titulo: "Confira no Labs antes de continuar",
        texto: `Pela resposta do Labs não dá para saber se este bônus foi criado. Abra o /admin do Labs e procure o endereço ${endereco}.${d.erro ? ` O Labs respondeu: ${d.erro}.` : ""}`,
      };
    case "titulo_repetido":
      return {
        tom: "erro",
        titulo: "Outro bônus já tem esse título",
        texto: `O bônus ${d.slugExistente ?? "existente"} usa o mesmo título. Mude o título e envie de novo.`,
      };
    case "palavra_repetida":
      return {
        tom: "erro",
        titulo: "Essa palavra-chave já leva a outro bônus",
        texto: `${d.palavra ?? "A palavra"} já é de outro bônus no Labs. Com duas iguais, o bônus novo ficaria com os comentários do antigo. Escolha outra palavra.`,
      };
    case "campos_invalidos":
      return {
        tom: "erro",
        titulo: "O Labs recusou alguns campos",
        texto: d.problemas.length ? textoDosProblemas(d.problemas) : "Confira os campos e envie de novo.",
      };
    case "tema_fora_do_catalogo":
      return {
        tom: "erro",
        titulo: "Esse tema não existe no Labs",
        texto: d.temasValidos.length
          ? `Escolha um destes: ${d.temasValidos.join(", ")}.`
          : "Escolha outro tema, ou cadastre este no /admin do Labs.",
      };
    case "tema_ausente":
      return { tom: "erro", titulo: "Faltou o tema", texto: "Escolha um tema e envie de novo." };
    case "palavra_ausente":
      return { tom: "erro", titulo: "Faltou a palavra-chave", texto: "Escreva a palavra-chave e envie de novo." };
    case "grande_demais":
      return { tom: "erro", titulo: "O bônus passou de 64 000 bytes", texto: "Encurte o prompt e envie de novo." };
    case "relogio":
      return {
        tom: "erro",
        titulo: "O Labs recusou o horário da assinatura",
        texto: "O relógio deste servidor está mais de 5 minutos fora do relógio do Labs. Isso se corrige no servidor, e não no bônus: avise quem cuida da hospedagem.",
      };
    case "assinatura":
      return {
        tom: "erro",
        titulo: "O Labs recusou a assinatura",
        texto: "O segredo deste servidor não é o mesmo do Labs. Confira o BONUS_INTAKE_SECRET dos dois lados.",
      };
    case "esperar":
      return {
        tom: "atencao",
        titulo: "O Labs pediu para esperar",
        texto: "Chegaram chamadas demais em pouco tempo. Espere um minuto e envie de novo.",
      };
    case "porta_desligada":
      return {
        tom: "atencao",
        titulo: "A porta do Labs está desligada",
        texto: "O Labs ainda não tem o segredo configurado e não aceita bônus de fora. Avise quem cuida do Labs.",
      };
    case "timeout":
      return incerto(`O Labs não respondeu em ${TIMEOUT_ENVIO_MS / 1000} segundos.`);
    case "rede":
      return incerto("A conexão com o Labs caiu.");
    case "resposta_grande":
      return incerto("A resposta do Labs veio grande demais para ser lida.");
    case "erro_do_labs":
      return incerto(`O Labs respondeu com erro ${d.status ?? "sem número"}.`);
    case "fora_do_contrato":
      return incerto(`O Labs respondeu algo que o contrato não prevê (status ${d.status ?? "desconhecido"}).`);
  }
}
