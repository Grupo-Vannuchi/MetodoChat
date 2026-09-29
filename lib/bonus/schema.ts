import { z } from "zod";

// O SCHEMA DA SAÍDA DA IA, TRAZIDO COMO ESTÁ do Método Labs (site-ia,
// src/lib/ia/schemas.ts, `BonusGeradoSchema`, commit bf6e923). As réguas vêm dos
// 50 bônus medidos lá; o schema é rede contra saída quebrada, e quem aperta o
// estilo é a instrução. Os nomes seguem os campos que a instrução pede.
//
// O slug vira endereço público (`/bonus/<slug>`) e a palavra é o que a pessoa
// comenta: a instrução PEDE o formato, e o schema GARANTE.
const slug = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug deve ser minúsculo, sem acento e separado por hífen");

export const BonusGeradoSchema = z.object({
  titulo: z.string().min(15).max(120),
  slug,
  palavraChave: z
    .string()
    .min(3)
    .max(14)
    .regex(/^[A-Z0-9]+$/, "palavra-chave deve ser UMA palavra em maiúsculas, sem acento"),
  descricao: z.string().min(80).max(400),
  intro: z.string().min(100).max(600),
  // Piso de 400: abaixo disso a geração falhou. Teto de 2000: do tamanho de uma
  // skill paga, o grátis estaria canibalizando o pago.
  prompt: z.string().min(400).max(2000),
});

export type BonusGerado = z.infer<typeof BonusGeradoSchema>;
