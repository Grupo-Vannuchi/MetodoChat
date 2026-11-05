import "server-only";
import { sql } from "./db";

// Freio de força bruta no login.
//
// A senha de cada login protege o painel (docs/specs/2026-11-04-logins.md). Sem
// freio, dá para chutar senha à vontade — e um único acerto entrega tudo. Até
// 04/11/2026 a senha era uma só, a ADMIN_PASSWORD, que ainda derivava a chave da
// sessão. Desde os logins, o mesmo freio vale para a entrada e para a senha atual
// da troca de senha.
//
// O contador mora no banco, não em memória: em serverless cada instância tem a
// sua, e um atacante que caia em instâncias diferentes nunca alcançaria o
// limite. Login é raro; uma consulta aqui não pesa.

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 8;

export const LOCKOUT_MESSAGE = `Muitas tentativas. Espere ${WINDOW_MINUTES} minutos e tente de novo.`;

// A TENTATIVA É CONTADA ANTES DA CONFERÊNCIA DA SENHA (achado 173 da auditoria,
// docs/specs/2026-11-04-logins.md). Até 04/11/2026 o freio olhava antes
// (`isLockedOut`) e só gravava a falha depois (`recordFailure`): uma rajada de
// pedidos em paralelo do mesmo IP passava inteira pela olhada antes de a
// primeira falha ser gravada. Sem custo na conferência, isso pesava pouco; com
// o scrypt dos logins (~480 ms e ~128 MiB cada), virava amplificação.
//
// Agora cada tentativa é RESERVADA antes do scrypt, numa transação com uma
// trava por IP (`pg_advisory_xact_lock`): conta a janela e, abaixo do teto,
// grava a tentativa. Acima do teto, recusa sem gravar e sem scrypt. O acerto
// limpa as tentativas do IP (`clearAttempts`), como antes. A conta é a mesma de
// antes: com 8 tentativas na janela, a nona ouve o freio.
//
// Falha ABERTA de propósito: se o banco estiver fora do ar, o freio não
// funciona, mas o login também não trava. Barrar aqui deixaria o dono do painel
// de fora justo quando ele mais precisa entrar — e a senha continua sendo
// exigida de qualquer forma (e, sem banco, nem a conferência dela acontece).
export async function reservarTentativa(ip: string): Promise<boolean> {
  try {
    const permitida = await sql().begin(async (tx) => {
      await tx.query(`select pg_advisory_xact_lock(hashtext('login_attempts:' || $1))`, [ip]);
      const [linha] = (await tx.query(
        `select count(*)::int as total from login_attempts
         where ip = $1 and attempted_at > now() - make_interval(mins => $2::int)`,
        [ip, WINDOW_MINUTES]
      )) as { total: number }[];
      if ((linha?.total ?? 0) >= MAX_ATTEMPTS) return false;
      await tx.query(`insert into login_attempts (ip) values ($1)`, [ip]);
      return true;
    });
    // limpeza oportunista: sem isto a tabela cresceria para sempre
    await sql().query(`delete from login_attempts where attempted_at < now() - interval '1 day'`);
    return permitida;
  } catch {
    return true;
  }
}

export async function clearAttempts(ip: string): Promise<void> {
  try {
    await sql().query(`delete from login_attempts where ip = $1`, [ip]);
  } catch {
    // as linhas expiram sozinhas pela janela de tempo
  }
}
