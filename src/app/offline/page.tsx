import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sem conexão — Corex" };

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
        background: "#0a0d12",
        color: "#ffffff",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      {/* Símbolo Corex // — barra sólida menta + barra vazada. Inline (a página não pode depender de asset). */}
      <span style={{ display: "inline-flex", gap: "7px" }} aria-hidden="true">
        <i style={{ display: "block", width: "15px", height: "34px", transform: "skewX(-16deg)", borderRadius: "3px", background: "#34f5c5" }} />
        <i style={{ display: "block", width: "15px", height: "34px", transform: "skewX(-16deg)", borderRadius: "3px", border: "2px solid #9aa3ad", boxSizing: "border-box" }} />
      </span>
      <h1 style={{ fontSize: "18px", fontWeight: 500, margin: 0 }}>Você está sem conexão</h1>
      <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#9aa3ad", maxWidth: "300px", margin: 0 }}>
        Não foi possível carregar esta tela. Verifique a internet e tente de novo.
      </p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- offline: recarrega o app inteiro ao voltar online (sem client-nav) */}
      <a
        href="/"
        style={{
          marginTop: "6px",
          display: "inline-flex",
          alignItems: "center",
          height: "40px",
          padding: "0 20px",
          borderRadius: "10px",
          background: "#34f5c5",
          color: "#04231c",
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
