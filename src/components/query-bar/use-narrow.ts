import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 767px)";
const subscribe = (onChange: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener?.("change", onChange);
  return () => media.removeEventListener?.("change", onChange);
};
const snapshot = () => typeof window !== "undefined" && !!window.matchMedia && !!window.matchMedia(QUERY)?.matches;

/** Abaixo de 768 px os filtros abrem em folha inferior (RF21). Sem matchMedia (SSR/testes) vale o desktop. */
export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
