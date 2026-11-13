import { describe, it, expect } from "vitest";
import { ALLOWED_RESOURCES, isAllowedResource, isAllowedRoute } from "./allowed-resources";

describe("allowlist do BFF", () => {
  it("libera todos os recursos de domínio (incl. engagements)", () => {
    for (const r of ["me", "projects", "tasks", "subtasks", "members", "roles", "engagements", "mcp"]) {
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

describe("rotas somente de leitura do BFF", () => {
  it("tasks/workflows/team aceita GET e HEAD", () => {
    expect(isAllowedRoute("GET", ["tasks", "workflows", "team"])).toBe(true);
    expect(isAllowedRoute("HEAD", ["tasks", "workflows", "team"])).toBe(true);
  });
  it("tasks/workflows/team recusa qualquer mutação", () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) expect(isAllowedRoute(method, ["tasks", "workflows", "team"])).toBe(false);
  });
  it("não afeta os demais caminhos de tasks nem recursos bloqueados", () => {
    expect(isAllowedRoute("POST", ["tasks", "t1", "workflow", "commands"])).toBe(true);
    expect(isAllowedRoute("GET", ["tasks", "workflows", "mine"])).toBe(true);
    expect(isAllowedRoute("GET", ["auth", "login"])).toBe(false);
    expect(isAllowedRoute("GET", [])).toBe(false);
  });
});
