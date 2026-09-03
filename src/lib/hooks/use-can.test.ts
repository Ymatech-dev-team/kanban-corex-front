import { describe, it, expect } from "vitest";
import { hasPermission } from "./use-can";

describe("hasPermission", () => {
  it("true quando a permissão está no conjunto", () => {
    expect(hasPermission(["tarefas.criar", "membros.ver"], "tarefas.criar")).toBe(true);
  });
  it("false quando não está", () => {
    expect(hasPermission(["membros.ver"], "projetos.excluir")).toBe(false);
  });
  it("false quando o conjunto é undefined (sessão ainda carregando)", () => {
    expect(hasPermission(undefined, "tarefas.criar")).toBe(false);
  });
});
