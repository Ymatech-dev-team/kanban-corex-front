import { describe, it, expect } from "vitest";
import { ALLOWED_RESOURCES, isAllowedResource } from "./allowed-resources";

describe("allowlist do BFF", () => {
  it("libera todos os recursos de domínio (incl. engagements)", () => {
    for (const r of ["me", "projects", "tasks", "subtasks", "members", "roles", "engagements"]) {
      expect(isAllowedResource(r)).toBe(true);
    }
  });

  it("engagements está liberado (regressão B2: /engagements/* dava 404 no BFF)", () => {
    expect(ALLOWED_RESOURCES.has("engagements")).toBe(true);
  });

  it("bloqueia recurso fora do catálogo e caminhos perigosos", () => {
    expect(isAllowedResource("auth")).toBe(false);
    expect(isAllowedResource("internal")).toBe(false);
    expect(isAllowedResource("..")).toBe(false);
    expect(isAllowedResource("")).toBe(false);
  });
});
