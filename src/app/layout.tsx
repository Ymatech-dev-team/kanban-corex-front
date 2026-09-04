import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Sistema de Tasks",
  description: "Organização de projetos e tarefas — YMALOG",
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
