import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// A FONTE DA ARTE: a Carlito, Regular (400) e Bold (700), os dois únicos pesos do manual de arte do
// perfil (trazido ao Labs em 02/09; site-ia, src/lib/ia/fonte-da-arte.ts). A hierarquia da peça é
// por PESO: sem os dois pesos entregues ao ImageResponse, o negrito do gancho sai fino.
//
// OS .ttf MORAM EM lib/bonus/fonte/, SEM MODIFICAÇÃO, com a licença OFL ao lado: o hash do git de
// cada um é o do Google Fonts (google/fonts, commit 3dd7884402, ofl/carlito), e
// tests/bonus-arte-fonte.test.ts confere. O Labs busca a fonte no Google Fonts a cada processo;
// aqui ela é lida do disco, uma vez, com o caminho por extenso em cada `readFile`, que é o padrão
// da documentação do Next 16 (image-response.md) e o que o rastreio de arquivos da Vercel enxerga.
// Só o preview da Vercel prova que os arquivos entraram na função. Se não entrarem, o conserto é
// `outputFileTracingIncludes` no next.config.ts.
//
// SEM FONTE DE RESERVA, de propósito: um slide na fonte errada sairia publicável e fora da
// identidade do perfil, sem erro nenhum. Se a leitura falhar, a promessa recusa e a rota responde
// com erro, que aparece na prévia. A próxima chamada tenta ler de novo.

export const FAMILIA_DA_ARTE = "Carlito";

export type FonteDaArte = { name: string; data: Buffer; weight: 400 | 700; style: "normal" };

let carregadas: Promise<FonteDaArte[]> | null = null;

export function fontesDaArte(): Promise<FonteDaArte[]> {
  carregadas ??= Promise.all([
    readFile(join(process.cwd(), "lib/bonus/fonte/Carlito-Regular.ttf")),
    readFile(join(process.cwd(), "lib/bonus/fonte/Carlito-Bold.ttf")),
  ]).then(
    ([regular, negrito]): FonteDaArte[] => [
      { name: FAMILIA_DA_ARTE, data: regular, weight: 400, style: "normal" },
      { name: FAMILIA_DA_ARTE, data: negrito, weight: 700, style: "normal" },
    ],
    (erro: unknown) => {
      carregadas = null;
      throw erro;
    }
  );
  return carregadas;
}
