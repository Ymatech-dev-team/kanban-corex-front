import { describe, it, expect } from "vitest";
import { buildMonthMatrix, dayKey, groupTasksByDay } from "./calendar";
import type { Task } from "@/lib/types";

describe("buildMonthMatrix", () => {
  it("cobre 6 semanas de 7 dias", () => {
    const m = buildMonthMatrix(2026, 8); // setembro/2026 (month 0-based)
    expect(m).toHaveLength(6);
    expect(m.every((w) => w.length === 7)).toBe(true);
  });
  it("começa no domingo anterior ao dia 1", () => {
    // 1/set/2026 é uma terça → a grade começa no domingo 30/ago
    const m = buildMonthMatrix(2026, 8);
    expect(m[0][0].getDay()).toBe(0);
    expect(dayKey(m[0][0])).toBe("2026-08-30");
  });
  it("contém o primeiro dia do mês", () => {
    const m = buildMonthMatrix(2026, 8);
    const flat = m.flat().map(dayKey);
    expect(flat).toContain("2026-09-01");
  });
});

function task(id: string, dueDate: string | null): Task {
  return {
    id,
    projectId: "p1",
    title: id,
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueDate,
    assigneeId: null,
    position: 1,
  };
}

describe("groupTasksByDay", () => {
  it("agrupa por dia e ignora sem prazo", () => {
    const g = groupTasksByDay([
      task("a", "2026-09-10T12:00:00"),
      task("b", "2026-09-10T15:00:00"),
      task("c", null),
    ]);
    expect(g["2026-09-10"].map((t) => t.id)).toEqual(["a", "b"]);
    expect(Object.values(g).flat()).toHaveLength(2);
  });
});
