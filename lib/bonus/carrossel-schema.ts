import { z } from "zod";

// O FORMATO DA SAÍDA DA IA PARA O CARROSSEL, a partir do do Método Labs (site-ia,
// src/lib/ia/schemas.ts, `CarrosselGeradoSchema`, `SlideSchema` e `PostUnicoSchema`, commit
// 01e609f). Os tetos de cada campo são os de lá, e vêm da geometria da arte: passar deles
// cortaria o texto na imagem, em silêncio. Os nomes são os que as instruções pedem.
//
// DUAS MUDANÇAS, decididas na spec da Etapa 2:
// - `slides` aceita de 0 a 8 (lá, de 6 a 9): aqui o total vai de 2 a 10, contando o gancho e a
//   chamada. Quem confere o número EXATO pedido é `conferirGerado` (carrossel-texto.ts);
// - no post único, a `chamadaParaAcao` é obrigatória (lá, opcional): aqui todo post existe
//   para levar a um bônus.

export const SlideSchema = z.object({
  titulo: z.string().min(8).max(70),
  texto: z.string().min(30).max(300),
});

export const CarrosselDoChatSchema = z.object({
  // Nome interno, para reconhecer na lista. Não vai para o post.
  titulo: z.string().min(10).max(90),
  // Slide 1.
  gancho: z.string().min(15).max(120),
  slides: z.array(SlideSchema).max(8),
  // Slide final.
  chamadaParaAcao: z.string().min(20).max(200),
  legenda: z.string().min(80).max(900),
});

export const PostDoChatSchema = z.object({
  titulo: z.string().min(10).max(90),
  texto: z.string().min(60).max(300),
  chamadaParaAcao: z.string().min(20).max(200),
  legenda: z.string().min(80).max(900),
});

export type CarrosselDoChat = z.infer<typeof CarrosselDoChatSchema>;
export type PostDoChat = z.infer<typeof PostDoChatSchema>;
