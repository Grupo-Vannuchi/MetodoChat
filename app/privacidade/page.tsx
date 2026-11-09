import { getConfig } from "@/lib/db";

export const metadata = { title: "Política de Privacidade" };
export const dynamic = "force-dynamic";

export default async function PrivacidadePage() {
  const config = await getConfig().catch(() => null);
  const owner = config?.username ? `@${config.username}` : "a conta de Instagram conectada a esta instância";

  return (
    <article className="mx-auto max-w-2xl space-y-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
      <h1 className="titulo text-2xl font-bold text-zinc-900 dark:text-zinc-100">Política de Privacidade</h1>

      <p>
        Este aplicativo é uma ferramenta de automação de uso pessoal, operada pelo titular de{" "}
        {owner}: quando alguém comenta uma palavra-chave em um post, responde a um story ou envia
        uma mensagem, o aplicativo envia uma mensagem direta automática em nome da conta conectada.
      </p>

      <h2 className="titulo text-lg font-semibold text-zinc-900 dark:text-zinc-100">Dados coletados</h2>
      <p>
        Para funcionar, o aplicativo recebe da API oficial do Instagram (Meta Platforms) e armazena:
        o identificador público e o nome de usuário de quem interage com a conta conectada, o texto
        de comentários e mensagens recebidos, e os horários dessas interações. Nenhum outro dado do
        Instagram é coletado. Não coletamos senhas, e-mails, telefones nem dados de navegação.
      </p>

      {/* O LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §7). O "Desconectar" diz o que faz e o que não
          faz (achado 206): o LinkedIn não tem como revogar a autorização de fora, e ela vence sozinha lá. */}
      <h2 className="titulo text-lg font-semibold text-zinc-900 dark:text-zinc-100">LinkedIn</h2>
      <p>
        Quando o dono de uma conta conecta o próprio LinkedIn pelo link de convite, o aplicativo guarda o
        identificador dele no LinkedIn, o nome e a autorização de publicar que o LinkedIn entrega, válida por 60
        dias. Esses dados servem só para publicar no perfil dele o que for agendado no painel.
      </p>
      <p>
        Para apagar: o administrador usa o &quot;Desconectar&quot; na Configuração, ou você faz o pedido de
        exclusão (abaixo). O aplicativo apaga a autorização e para de usá-la; no LinkedIn, ela vence sozinha em
        até 60 dias.
      </p>

      <h2 className="titulo text-lg font-semibold text-zinc-900 dark:text-zinc-100">Uso dos dados</h2>
      <p>
        Os dados são usados exclusivamente para enviar as respostas automáticas configuradas pelo
        administrador e para exibir um histórico simples no painel privado. Os dados não são
        vendidos, compartilhados nem usados para publicidade.
      </p>

      <h2 className="titulo text-lg font-semibold text-zinc-900 dark:text-zinc-100">Armazenamento</h2>
      <p>
        Os dados ficam em banco de dados PostgreSQL protegido, acessível apenas pelo servidor do
        aplicativo. O acesso ao painel é protegido por senha.
      </p>

      <h2 className="titulo text-lg font-semibold text-zinc-900 dark:text-zinc-100">Exclusão de dados</h2>
      <p>
        Você pode solicitar a exclusão dos seus dados a qualquer momento. Veja as instruções em{" "}
        <a href="/exclusao-de-dados" className="text-tinta underline dark:text-tinta-escuro">
          /exclusao-de-dados
        </a>
        .
      </p>

      <h2 className="titulo text-lg font-semibold text-zinc-900 dark:text-zinc-100">Contato</h2>
      <p>Dúvidas sobre esta política: envie uma mensagem direta no Instagram para {owner}.</p>
    </article>
  );
}
