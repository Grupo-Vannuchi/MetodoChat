// AS DECISÕES PURAS DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §5), SEM IMPORT DE SERVIDOR: a
// tela de cliente e o servidor leem as mesmas regras. Na parte 1 (a conexão), só o vencimento; as formas, o
// texto e a classificação dos erros vêm na parte 2, que publica.

/** O aviso de que a autorização vai vencer começa a 7 dias. */
export const AVISO_DO_VENCIMENTO_DIAS = 7;

const DIA_MS = 86_400_000;

export type Vencimento = { estado: "valido" | "perto" | "vencido"; dias: number; frase: string };

/**
 * O VENCIMENTO DA AUTORIZAÇÃO DO LINKEDIN: 60 dias, sem renovação automática (renovar é mandar um convite
 * novo). Um pedaço de dia conta como um dia inteiro, e o prazo vence no próprio instante, como o do convite
 * (`estadoDoConvite`, lib/convites.ts). A data pode chegar como texto, de um componente de cliente.
 */
export function vencimentoDoLinkedin(expiraEm: Date | string, agoraMs: number): Vencimento {
  const falta = new Date(expiraEm).getTime() - agoraMs;
  if (!(falta > 0)) return { estado: "vencido", dias: 0, frase: "venceu" };
  const dias = Math.ceil(falta / DIA_MS);
  return {
    estado: dias <= AVISO_DO_VENCIMENTO_DIAS ? "perto" : "valido",
    dias,
    frase: dias === 1 ? "vence em 1 dia" : `vence em ${dias} dias`,
  };
}
