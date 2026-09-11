import { permanentRedirect } from "next/navigation";

// O ENDEREÇO ANTIGO DOS AGENDADOS, mantido vivo.
//
// Até 11/09/2026 a lista de posts agendados morava aqui, e `/publicar` era o
// formulário de compor. Os dois trocaram de lugar: o calendário virou a cara da
// seção e o compositor desceu para `/publicar/novo`.
//
// ESTE ARQUIVO EXISTE PORQUE A EQUIPE USA O PAINEL DESDE 09/09, e endereço que
// alguém salvou não pode virar 404 por uma decisão de arquitetura nossa. O
// painel também mandava para cá quando uma publicação falhava — aquele link já
// aponta para o novo lugar, mas um e-mail ou uma conversa de WhatsApp com o
// endereço antigo continua funcionando.
//
// `permanentRedirect` (308) E NÃO `redirect` (307): a mudança é definitiva, e o
// 308 é o que faz o navegador e qualquer coisa que tenha guardado o endereço
// pararem de perguntar. O método é preservado nos dois, então nenhum formulário
// se perde no caminho.
//
// A QUERY VAI JUNTO, e isso não é detalhe: os avisos de cancelar e remarcar
// viajam por `?aviso=&tom=`, e um redirecionamento que os descartasse faria a
// confirmação do cancelamento sumir — a mesma saída muda que este produto vem
// fechando desde 02/09.
export default async function AgendadosMudouDeEndereco({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(sp)) {
    if (valor === undefined) continue;
    query.set(chave, Array.isArray(valor) ? (valor[0] ?? "") : valor);
  }
  const texto = query.toString();
  permanentRedirect(texto ? `/publicar?${texto}` : "/publicar");
}
