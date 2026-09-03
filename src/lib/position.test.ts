import { describe, it, expect } from "vitest";
import { midpoint, positionForIndex } from "./position";

describe("midpoint", () => {
  it("coluna vazia começa em 1", () => {
    expect(midpoint(null, null)).toBe(1);
  });
  it("topo fica antes do primeiro", () => {
    expect(midpoint(null, 10)).toBe(9);
  });
  it("fim fica depois do último", () => {
    expect(midpoint(10, null)).toBe(11);
  });
  it("entre dois vira o ponto-médio", () => {
    expect(midpoint(10, 20)).toBe(15);
  });
  it("aguenta várias inserções seguidas no mesmo vão", () => {
    let a = 0;
    let b = 1;
    for (let i = 0; i < 20; i++) {
      const m = midpoint(a, b);
      expect(m).toBeGreaterThan(a);
      expect(m).toBeLessThan(b);
      b = m; // sempre insere logo abaixo do topo
    }
  });
});

describe("positionForIndex", () => {
  const ordered = [10, 20, 30];
  it("topo", () => expect(positionForIndex(ordered, 0)).toBe(9));
  it("meio", () => expect(positionForIndex(ordered, 1)).toBe(15));
  it("fim", () => expect(positionForIndex(ordered, 3)).toBe(31));
  it("coluna vazia", () => expect(positionForIndex([], 0)).toBe(1));
});
