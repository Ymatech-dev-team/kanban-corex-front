import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sem conexão — YMALOG" };

// Página servida pelo service worker quando uma navegação falha por rede. Precisa renderizar SEM
// depender de JS/CSS externo (os chunks /_next podem faltar offline/pós-deploy) — por isso os
// estilos são inline. Sem dados, sem auth. [PWA / painel]
export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        padding: "24px",
        textAlign: "center",
        background: "#0a0a0a",
        color: "#ededed",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <svg width="56" height="56" viewBox="0 0 512 512" aria-hidden="true">
        <rect width="512" height="512" rx="112" fill="#141414" />
        <path
          d="M132 140 L256 276 L380 140 M256 276 L256 392"
          fill="none"
          stroke="#ffc600"
          strokeWidth="62"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <h1 style={{ fontSize: "18px", fontWeight: 500, margin: 0 }}>Você está sem conexão</h1>
      <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#a1a1a1", maxWidth: "300px", margin: 0 }}>
        Não foi possível carregar esta tela. Verifique a internet e tente de novo.
      </p>
      <a
        href="/"
        style={{
          marginTop: "6px",
          display: "inline-flex",
          alignItems: "center",
          height: "40px",
          padding: "0 20px",
          borderRadius: "10px",
          background: "#ffc600",
          color: "#141414",
          fontSize: "14px",
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        Tentar de novo
      </a>
    </main>
  );
}
