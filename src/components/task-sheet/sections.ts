/** Seções da folha, na ordem da rolagem única (RF28). Os ids são únicos na página e alvo do índice. */
export const SHEET_SECTIONS = {
  now: { id: "sheet-agora", label: "Agora" },
  steps: { id: "sheet-passos", label: "Passos" },
  review: { id: "sheet-revisao", label: "Revisão" },
  diary: { id: "sheet-diario", label: "Diário" },
  file: { id: "sheet-ficha", label: "Ficha" },
} as const;

export type SheetSectionKey = keyof typeof SHEET_SECTIONS;

/** Rola até a seção e leva o foco a ela, sem mexer no hash da URL (a folha também abre como rota interceptada). */
export function scrollToSection(id: string): void {
  const el = typeof document === "undefined" ? null : document.getElementById(id);
  if (!el) return;
  const reduce = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  // O foco vai junto: quem usa teclado ou leitor de tela continua a partir da seção, não do link do índice. A seção tem tabIndex -1.
  el.focus({ preventScroll: true });
}
