import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Script from "next/script";
import { cookies } from "next/headers";
import "./globals.css";
import AppShell from "./app-shell";
import { SwitcherAccount } from "./account-switcher";
import { listAccounts } from "@/lib/db";
import { ACCOUNT_COOKIE } from "@/lib/account";

// AS TRÊS FAMÍLIAS. A Sora saiu: não por ser ruim, mas por ser a fonte que
// aparece em todo modelo de SaaS — ela era metade do "ar de modelo" que a
// auditoria de 10/09 mediu. Cada uma entra por um papel, e os papéis não se
// misturam.
//
// TÍTULOS — Archivo, no corte EXPANDIDO, que é o motivo inteiro da escolha:
// cara de placa, de quadro de operação, e fora do grupo Inter/Sora/Poppins.
//
// ELA É A ÚNICA DAS TRÊS QUE ENTRA COMO VARIÁVEL, e a razão é medida e não
// preferência: "expandido" na Archivo é um EIXO (`wdth`, 62..125), e nenhum
// corte estático dela o tem. `next/font` só aceita `axes` quando o peso é
// variável (`validate-google-font-function-call.js`: "Axes can only be defined
// for variable fonts"), então pedir dois pesos estáticos aqui seria pedir uma
// Archivo SEM o corte expandido — ou seja, pagar por uma fonte e não levar o
// que se foi buscar. O custo está contido: é UM arquivo, no lugar do UM arquivo
// variável que a Sora já ocupava. O eixo é aplicado pela utilidade `titulo`
// (app/globals.css), e não por classe de peso.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--fonte-titulo",
});

// TEXTO E INTERFACE — IBM Plex Sans, por legibilidade real em corpo pequeno,
// que é o que este produto tem em quase toda tela.
//
// OS PESOS SÃO PEDIDOS UM A UM, e são exatamente os que a interface usa: 400
// (corpo), 500 (`font-medium`, 59 ocorrências), 600 (`font-semibold`, 70) e 700
// (`font-bold`, 20). A Plex Sans também tem corte variável, e ele foi recusado
// aqui pelo motivo oposto ao da Archivo: esta é a fonte de TODO o texto, não há
// eixo nenhum a percorrer, e a faixa variável carregaria de 100 a 700 para usar
// quatro paradas.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fonte-texto",
});

// TEMPO, NÚMERO E IDENTIFICADOR — IBM Plex Mono, irmã da anterior, para
// timestamp, contagem e identificador em tabular de verdade.
//
// `preload: false` de propósito: ela pinta oito lugares do produto inteiro
// (`font-mono` e `tabular-nums`), e nenhum deles é o primeiro pixel de nenhuma
// tela. Precarregar a terceira família custaria um pedido bloqueante em toda
// rota para um texto que quase nunca está acima da dobra.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fonte-mono",
  preload: false,
});

const fontes = `${archivo.variable} ${plexSans.variable} ${plexMono.variable}`;

export const metadata: Metadata = {
  title: "MetodoChat — comentário vira DM",
  description: "Automação do seu Instagram: palavra-chave no comentário vira DM com seu link.",
};

// Aplica o tema salvo antes da primeira pintura (evita flash de cor errada)
const themeScript = `try{var t=localStorage.getItem("theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Contas conectadas alimentam o seletor da sidebar. Sem banco/config ainda
  // (primeiro acesso, páginas públicas), a sidebar aparece sem conta.
  let accounts: SwitcherAccount[] = [];
  let selectedId: string | null = null;
  try {
    accounts = (await listAccounts()).map((a) => ({
      ig_user_id: a.ig_user_id,
      username: a.username,
      profile_picture_url: a.profile_picture_url,
    }));
    const cookieId = (await cookies()).get(ACCOUNT_COOKIE)?.value;
    selectedId =
      accounts.find((a) => a.ig_user_id === cookieId)?.ig_user_id ??
      accounts[0]?.ig_user_id ??
      null;
  } catch {
    // banco indisponível: segue sem contas
  }

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${fontes} font-sans min-h-screen bg-papel text-tinta antialiased dark:bg-papel-escuro dark:text-tinta-escuro`}
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <AppShell accounts={accounts} selectedId={selectedId}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
