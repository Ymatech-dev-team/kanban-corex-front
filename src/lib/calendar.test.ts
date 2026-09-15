import { describe, it, expect } from "vitest";
import { agendaDaysForMonth, buildMonthMatrix, dayKey, groupTasksByDay } from "./calendar";
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

function task(id: string, dueDate: string | null, extra?: Partial<Task>): Task {
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
    ...extra,
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

describe("agendaDaysForMonth", () => {
  const cursor = new Date(2026, 8, 1); // setembro/2026

  it("retorna só os dias do mês do cursor, em ordem crescente", () => {
    const byDay = groupTasksByDay([
      task("set-20", "2026-09-20T10:00:00"),
      task("set-05", "2026-09-05T10:00:00"),
      task("out", "2026-10-01T10:00:00"), // outro mês → fora
      task("ago", "2026-08-31T10:00:00"), // outro mês → fora
    ]);
    const days = agendaDaysForMonth(byDay, cursor);
    expect(days.map((d) => d.key)).toEqual(["2026-09-05", "2026-09-20"]);
  });

  it("a data derivada é local (não desloca dia por UTC)", () => {
    const byDay = groupTasksByDay([task("a", "2026-09-05T10:00:00")]);
    const [day] = agendaDaysForMonth(byDay, cursor);
    expect(day.date.getDate()).toBe(5);
    expect(day.date.getMonth()).toBe(8);
    expect(dayKey(day.date)).toBe("2026-09-05");
  });

  it("ordena dentro do dia: abertas antes de concluídas, depois posição", () => {
    const byDay = groupTasksByDay([
      task("done", "2026-09-10T10:00:00", { status: "DONE", position: 1 }),
      task("todo-2", "2026-09-10T10:00:00", { status: "TODO", position: 2 }),
      task("todo-1", "2026-09-10T10:00:00", { status: "DOING", position: 1 }),
    ]);
    const [day] = agendaDaysForMonth(byDay, cursor);
    expect(day.tasks.map((t) => t.id)).toEqual(["todo-1", "todo-2", "done"]);
  });

  it("mês sem tarefa retorna vazio", () => {
    const byDay = groupTasksByDay([task("out", "2026-10-01T10:00:00")]);
    expect(agendaDaysForMonth(byDay, cursor)).toEqual([]);
  });
});
