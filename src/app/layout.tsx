import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";
import { ServiceWorkerRegister } from "./sw-register";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// Título do login (Space Grotesk 500). Exposta como var; usada pontualmente. [login-redesign]
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500"], variable: "--font-display" });

const SITE_URL = "https://tasks.corexsistemas.com.br";
const SITE_TITLE = "Tasks - Corex Sistemas";
const SITE_DESC = "Organização de projetos e tarefas";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESC,
  applicationName: "Corex", // nome curto do PWA (ícone na tela inicial) — fica "Corex" de propósito
  // preview de link (Open Graph + Twitter) — título/descrição da marca + ícone
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESC,
    url: SITE_URL,
    siteName: "Corex",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Corex" }],
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESC,
    images: ["/icons/icon-512.png"],
  },
  // iOS "Adicionar à Tela de Início": abre em tela cheia, barra de status escura (combina com o dark).
  appleWebApp: { capable: true, title: "Corex", statusBarStyle: "black" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

// Cara de app no celular: encosta nas bordas (notch), safe-area disponível, barra do sistema colorida.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0d12" },
    { media: "(prefers-color-scheme: light)", color: "#f6f6f7" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Tema vem de cookie → o servidor já renderiza a classe certa (sem flash, sem mismatch de hidratação).
  const theme = (await cookies()).get("sdt-theme")?.value;
  const fonts = `${inter.variable} ${spaceGrotesk.variable}`;
  const className = theme === "light" ? `${fonts} light` : fonts;

  return (
    <html lang="pt-BR" className={className}>
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
