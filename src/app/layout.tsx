import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";
import { ServiceWorkerRegister } from "./sw-register";

const manrope = localFont({
  src: [
    { path: "../assets/fonts/Manrope-Regular.ttf", weight: "400", style: "normal" },
    { path: "../assets/fonts/Manrope-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../assets/fonts/Manrope-ExtraBold.ttf", weight: "800", style: "normal" },
  ],
  variable: "--font-manrope",
  display: "swap",
});

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
  icons: { icon: "/brand/favicon.svg", apple: "/icons/apple-touch-icon.png" },
};

// Cara de app no celular: encosta nas bordas (notch), safe-area disponível, barra do sistema colorida.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#091E2B" },
    { media: "(prefers-color-scheme: light)", color: "#F5F5F0" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Tema vem de cookie → o servidor já renderiza a classe certa (sem flash, sem mismatch de hidratação).
  const theme = (await cookies()).get("sdt-theme")?.value;
  const activeTheme = theme === "dark" ? "dark" : "light";
  const className = `${manrope.variable} ${activeTheme}`;

  return (
    <html lang="pt-BR" className={className} data-theme={activeTheme}>
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
