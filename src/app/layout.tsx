import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Sistema de Tasks",
  description: "Organização de projetos e tarefas — YMALOG",
};

// Cara de app no celular: encosta nas bordas (notch), safe-area disponível, barra do sistema colorida.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
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
      </body>
    </html>
  );
}
