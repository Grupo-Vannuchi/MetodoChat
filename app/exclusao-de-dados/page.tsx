import { getConfig } from "@/lib/db";

export const metadata = { title: "Exclusão de Dados" };
export const dynamic = "force-dynamic";

export default async function ExclusaoDeDadosPage() {
  const config = await getConfig().catch(() => null);
  const owner = config?.username ? `@${config.username}` : "a conta de Instagram conectada a esta instância";

  return (
    <article className="mx-auto max-w-2xl space-y-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
      <h1 className="titulo text-2xl font-bold text-zinc-900 dark:text-zinc-100">Exclusão de Dados</h1>
      <p>
        Este aplicativo armazena apenas o identificador público do Instagram, o nome de usuário e o
        texto de comentários/mensagens de quem interage com a conta conectada.
      </p>
      <p>
        Para solicitar a exclusão de todos os seus dados, envie uma mensagem direta no Instagram
        para {owner} pedindo a exclusão dos seus dados.
      </p>
      <p>
        A exclusão é feita em até 7 dias e remove todos os registros associados ao seu usuário do
        banco de dados desta instância.
      </p>
      {/* O LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; achado 206). */}
      <p>
        Se você conectou o seu LinkedIn a este aplicativo, ele guarda o seu identificador no LinkedIn, o seu
        nome e a autorização de publicar, válida por 60 dias. A exclusão apaga esses dados, e o aplicativo para
        de usar a autorização; no LinkedIn, ela vence sozinha em até 60 dias. O administrador também pode
        apagá-los na hora, pelo &quot;Desconectar&quot; da Configuração.
      </p>
    </article>
  );
}
