import type { Task } from "@/lib/types";

/** Filtro de responsável do quadro. Cliente-side sobre as tarefas já carregadas. */
export type AssigneeFilter = { type: "all" } | { type: "none" } | { type: "user"; id: string };

export const ALL_ASSIGNEES: AssigneeFilter = { type: "all" };

export function filterByAssignee(tasks: Task[], f: AssigneeFilter): Task[] {
  if (f.type === "all") return tasks;
  if (f.type === "none") return tasks.filter((t) => t.assigneeId == null);
  return tasks.filter((t) => t.assigneeId === f.id);
}

export function isFiltering(f: AssigneeFilter): boolean {
  return f.type !== "all";
}
