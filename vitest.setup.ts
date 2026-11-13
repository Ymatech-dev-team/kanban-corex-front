import "@testing-library/jest-dom/vitest";

// JSDOM has no layout observer. HeroUI tabs use it only to measure the indicator.
class TestResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = TestResizeObserver;
// The test DOM does not run Web Animations; an empty list matches that environment.
if (typeof Element !== "undefined") Element.prototype.getAnimations = () => [];
