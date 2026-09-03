import { describe, it, expect } from "vitest";
import { csrfMatches } from "./csrf";

describe("CSRF double-submit [SEC-008]", () => {
  it("header e cookie iguais → ok", () => {
    expect(csrfMatches("tok123", "tok123")).toBe(true);
  });
  it("diferentes → falha", () => {
    expect(csrfMatches("tok123", "outro")).toBe(false);
  });
  it("ausente (header ou cookie) → falha", () => {
    expect(csrfMatches(null, "tok")).toBe(false);
    expect(csrfMatches("tok", undefined)).toBe(false);
  });
});
