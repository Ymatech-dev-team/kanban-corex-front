"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 767px)";
const subscribe = (notify: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const snapshot = () => (typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(QUERY).matches);

/** Abaixo de 768 px a Agora troca a tabela pela lista de 3 níveis (RF18). Sem matchMedia (SSR/testes) vale o desktop. */
export function useIsNarrow(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
