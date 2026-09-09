import { describe, it, expect } from "vitest";
import { filterByAssignee, isFiltering } from "./filter";
import type { Task } from "@/lib/types";

function task(id: string, assigneeId: string | null): Task {
  return {
    id,
    projectId: "p1",
    title: id,
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: null,
    assigneeId,
    position: 1,
  };
}

const tasks = [task("a", "u1"), task("b", "u2"), task("c", null), task("d", "u1")];

describe("filterByAssignee", () => {
  it("all devolve tudo", () => {
    expect(filterByAssignee(tasks, { type: "all" })).toHaveLength(4);
  });
  it("user filtra pelo id", () => {
    expect(filterByAssignee(tasks, { type: "user", id: "u1" }).map((t) => t.id)).toEqual(["a", "d"]);
  });
  it("none pega só sem responsável", () => {
    expect(filterByAssignee(tasks, { type: "none" }).map((t) => t.id)).toEqual(["c"]);
  });
  it("casa também quem é responsável EXTRA", () => {
    const withExtra = [{ ...task("e", "u9"), extraAssigneeIds: ["u1"] }];
    expect(filterByAssignee(withExtra, { type: "user", id: "u1" }).map((t) => t.id)).toEqual(["e"]);
  });
  it("none exige sem principal E sem extras", () => {
    const withExtra = [{ ...task("f", null), extraAssigneeIds: ["u1"] }];
    expect(filterByAssignee(withExtra, { type: "none" })).toHaveLength(0);
  });
});

describe("isFiltering", () => {
  it("all não é filtro", () => expect(isFiltering({ type: "all" })).toBe(false));
  it("user é filtro", () => expect(isFiltering({ type: "user", id: "u1" })).toBe(true));
  it("none é filtro", () => expect(isFiltering({ type: "none" })).toBe(true));
});
