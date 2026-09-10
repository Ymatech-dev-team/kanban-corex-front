import { describe, it, expect } from "vitest";
import { dueState, needsAttention, dueTag, isDueUrgent } from "./due";
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

describe("dueTag (tag de prazo no card/detalhe)", () => {
  it("sem prazo → none, sem label", () => {
    expect(dueTag(null, "TODO", NOW)).toEqual({ state: "none", label: "" });
  });
  it("feita → none mesmo vencida", () => {
    expect(dueTag(at(2026, 8, 1), "DONE", NOW).state).toBe("none");
  });
  it("passado → overdue 'venceu …'", () => {
    const r = dueTag(at(2026, 8, 9), "TODO", NOW);
    expect(r.state).toBe("overdue");
    expect(r.label).toMatch(/^venceu/);
  });
  it("hoje → today 'vence hoje'", () => {
    expect(dueTag(at(2026, 8, 10), "TODO", NOW)).toEqual({ state: "today", label: "vence hoje" });
  });
  it("amanhã → tomorrow (separado de hoje) 'vence amanhã'", () => {
    expect(dueTag(at(2026, 8, 11), "TODO", NOW)).toEqual({ state: "tomorrow", label: "vence amanhã" });
  });
  it("daqui a dias → future com data", () => {
    expect(dueTag(at(2026, 8, 20), "TODO", NOW).state).toBe("future");
  });
});

describe("isDueUrgent (âmbar só vencida+hoje)", () => {
  it("vencida é urgente", () => expect(isDueUrgent("overdue")).toBe(true));
  it("hoje é urgente", () => expect(isDueUrgent("today")).toBe(true));
  it("amanhã NÃO é urgente", () => expect(isDueUrgent("tomorrow")).toBe(false));
  it("futuro NÃO é urgente", () => expect(isDueUrgent("future")).toBe(false));
  it("sem prazo NÃO é urgente", () => expect(isDueUrgent("none")).toBe(false));
});

describe("needsAttention", () => {
  it("vencida chama atenção", () => expect(needsAttention(task(at(2026, 8, 9)), NOW)).toBe(true));
  it("hoje chama atenção", () => expect(needsAttention(task(at(2026, 8, 10)), NOW)).toBe(true));
  it("longe não chama", () => expect(needsAttention(task(at(2026, 8, 25)), NOW)).toBe(false));
  it("feita não chama", () => expect(needsAttention(task(at(2026, 8, 9), "DONE"), NOW)).toBe(false));
});
