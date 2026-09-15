import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";
import { ServiceWorkerRegister } from "./sw-register";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Corex",
  description: "Organização de projetos e tarefas — Corex",
  applicationName: "Corex",
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
  const className = theme === "light" ? `${inter.variable} light` : inter.variable;

  return (
    <html lang="pt-BR" className={className}>
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
