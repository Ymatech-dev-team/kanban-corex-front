"use client";

import { useEffect } from "react";

// Registra o service worker (só em produção; em dev o SW briga com o HMR do Turbopack).
// Em contexto inseguro (http em IP de LAN) `serviceWorker` some do navigator → no-op silencioso.
// Também desregistra SW de teste que tenha ficado quando não é produção. [PWA / painel]
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
