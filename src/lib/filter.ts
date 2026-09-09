import type { Task } from "@/lib/types";

/** Filtro de responsável do quadro. Cliente-side sobre as tarefas já carregadas. */
export type AssigneeFilter = { type: "all" } | { type: "none" } | { type: "user"; id: string };

export const ALL_ASSIGNEES: AssigneeFilter = { type: "all" };

export function filterByAssignee(tasks: Task[], f: AssigneeFilter): Task[] {
  if (f.type === "all") return tasks;
  // "sem responsável" = sem principal E sem extras [detalhe-tarefa RF-R9]
  if (f.type === "none") return tasks.filter((t) => t.assigneeId == null && (t.extraAssigneeIds?.length ?? 0) === 0);
  return tasks.filter((t) => t.assigneeId === f.id || (t.extraAssigneeIds?.includes(f.id) ?? false));
}

export function isFiltering(f: AssigneeFilter): boolean {
  return f.type !== "all";
}
