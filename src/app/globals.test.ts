import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "globals.css"), "utf8");

/** Corpo do primeiro bloco `@layer components { ... }` que contém `needle`. */
function layerBlock(needle: string): string {
  const start = css.indexOf("@layer components {", css.indexOf(needle) - 400);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error("bloco sem fim");
}

describe("globals.css — régua de forma (RF1)", () => {
  it("tokens: 2px estrutura, 4px controles, sem pílulas", () => {
    expect(css).toMatch(/--radius: \.125rem;/);
    expect(css).toMatch(/--field-radius: \.25rem;/);
    for (const [name, value] of [["sm", ".125rem"], ["md", ".25rem"], ["lg", ".25rem"], ["3xl", ".25rem"], ["4xl", ".25rem"]]) expect(css).toContain(`--radius-${name}: ${value};`);
  });
  it("painéis e overlays do HeroUI voltam para var(--radius)", () => {
    const block = layerBlock(".table-root--primary");
    for (const cls of [".card", ".popover", ".toast", ".alert", ".alert-dialog__dialog", ".accordion--surface", ".modal__dialog", ".dropdown__popover", ".select__popover", ".combo-box__popover", ".autocomplete__popover", ".color-picker__popover", ".date-picker__popover", ".date-range-picker__popover", ".table-root--primary", ".tabs__list-container"]) expect(block, cls).toContain(cls);
    expect(block).toMatch(/border-radius: var\(--radius\);/);
  });
});

describe("globals.css — movimento ≤ 200 ms (RNF1)", () => {
  const motion = css.slice(css.indexOf("Movimento: nada passa"));
  it("limita as classes lentas do HeroUI a --motion-panel, fora de @layer", () => {
    expect(css).toMatch(/--motion-panel: 200ms;/);
    for (const cls of [".tabs__indicator", ".accordion__indicator", ".disclosure__indicator", ".button", ".drawer__backdrop", ".switch__thumb"]) expect(motion, cls).toContain(cls);
    expect(motion).toMatch(/transition-duration: var\(--motion-panel\);/);
    expect(motion).toMatch(/animation-duration: var\(--motion-panel\)/);
    expect(motion).toMatch(/\.toast \{ --toast-enter-duration: var\(--motion-panel\); --toast-exit-duration: var\(--motion-panel\); \}/);
    expect(motion).toMatch(/\.drawer__content \{ --drawer-enter-duration: var\(--motion-panel\);/);
    // o bloco de movimento não está dentro de um @layer (vence a especificidade do pacote)
    const before = css.slice(0, css.indexOf("Movimento: nada passa")).replace(/\/\*[\s\S]*?\*\//g, "");
    expect((before.match(/\{/g) ?? []).length - (before.match(/\}/g) ?? []).length).toBe(0);
  });
  it("o reduced-motion existente continua !important", () => {
    const block = css.match(/prefers-reduced-motion:reduce\) \{[^}]*\}/)?.[0] ?? "";
    expect(block).toContain("animation-duration: .01ms!important");
    expect(block).toContain("transition-duration: .01ms!important");
    // Animações infinitas (skeleton/pulse) param em vez de piscar. [lente UX N2]
    expect(block).toContain("animation-iteration-count: 1!important");
  });
});
