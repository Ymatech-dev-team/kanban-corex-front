import { describe, it, expect } from "vitest";
import { dueState, needsAttention } from "./due";
import type { Task } from "@/lib/types";

const NOW = new Date(2026, 8, 10, 10, 0, 0).getTime(); // 10/set/2026 10h local
const at = (y: number, m: number, d: number) => new Date(y, m, d, 12, 0, 0).toISOString();

describe("dueState", () => {
  it("sem prazo → none", () => {
    expect(dueState(null, "TODO", NOW).state).toBe("none");
  });
  it("feita → none mesmo vencida", () => {
    expect(dueState(at(2026, 8, 1), "DONE", NOW).state).toBe("none");
  });
  it("passado → overdue", () => {
    const r = dueState(at(2026, 8, 9), "TODO", NOW);
    expect(r.state).toBe("overdue");
    expect(r.label).toMatch(/^venceu/);
  });
  it("hoje → soon 'vence hoje'", () => {
    expect(dueState(at(2026, 8, 10), "TODO", NOW)).toEqual({ state: "soon", label: "vence hoje" });
  });
  it("amanhã → soon 'vence amanhã'", () => {
    expect(dueState(at(2026, 8, 11), "TODO", NOW)).toEqual({ state: "soon", label: "vence amanhã" });
  });
  it("daqui a dias → normal com data", () => {
    expect(dueState(at(2026, 8, 20), "TODO", NOW).state).toBe("normal");
  });
});

function task(dueDate: string | null, status: Task["status"] = "TODO"): Task {
  return {
    id: "t",
    projectId: "p",
    title: "t",
    description: null,
    status,
    priority: "MEDIUM",
    dueDate,
    assigneeId: null,
    position: 1,
  };
}

describe("needsAttention", () => {
  it("vencida chama atenção", () => expect(needsAttention(task(at(2026, 8, 9)), NOW)).toBe(true));
  it("hoje chama atenção", () => expect(needsAttention(task(at(2026, 8, 10)), NOW)).toBe(true));
  it("longe não chama", () => expect(needsAttention(task(at(2026, 8, 25)), NOW)).toBe(false));
  it("feita não chama", () => expect(needsAttention(task(at(2026, 8, 9), "DONE"), NOW)).toBe(false));
});
