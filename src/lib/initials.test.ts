import { describe, it, expect } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  it("nome composto usa primeira + última", () => {
    expect(initials("Ana Paula Souza")).toBe("AS");
  });
  it("nome único usa as duas primeiras letras", () => {
    expect(initials("Bruno")).toBe("BR");
  });
  it("aguenta espaços extras", () => {
    expect(initials("  João   Lima ")).toBe("JL");
  });
  it("vazio vira ?", () => {
    expect(initials("   ")).toBe("?");
  });
});
