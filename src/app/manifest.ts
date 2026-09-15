import type { MetadataRoute } from "next";

// Manifest do PWA (Next gera /manifest.webmanifest e injeta o <link> sozinho). [PWA]
// theme/background únicos e escuros (dark-first) — o <meta name=theme-color> por-esquema do
// viewport ainda vence a barra do sistema em runtime.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Sistema de Tasks — YMALOG",
    short_name: "YMALOG Tasks",
    description: "Organização de projetos e tarefas — YMALOG",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    dir: "ltr",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
